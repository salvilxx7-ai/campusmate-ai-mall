import * as db from "../db";
import { invokeLLM } from "../_core/llm";
import { decideGrounding } from "./grounding";
import { routeWithPythonAgent, type PythonAgentRoute } from "./pythonAgentGateway";

export type CustomerIntent = "policy_qa" | "product_search" | "own_order" | "human_handoff";
export type WorkflowStage = "received" | "intent_routed" | "retrieval" | "tool_invoked" | "answer_generated" | "handoff_ready";
export type WorkflowStep = { stage: WorkflowStage; detail: string };
export type ToolResult = { tool: "knowledge_search" | "product_search" | "own_order_lookup" | "handoff_advice"; status: "completed" | "blocked" | "not_found"; summary: string };

export function classifyCustomerIntent(message: string): CustomerIntent {
  const normalized = message.toLowerCase();
  if (/人工|真人|投诉|转接|客服专员/.test(normalized)) return "human_handoff";
  if (/订单|订单号|下单|我的订单|取货码/.test(normalized)) return "own_order";
  if (/规则|上架|禁止|售后|退货|退款|纠纷|签收|描述不符|安全吗/.test(normalized)) return "policy_qa";
  if (/商品|相机|耳机|教材|阅读灯|收纳|瑜伽|有没有|找.*(书|物|机)/.test(normalized)) return "product_search";
  return "policy_qa";
}

function extractOrderId(message: string) {
  const match = message.match(/(?:订单|订单号|#)\s*(\d+)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function fallbackFromEvidence(content: string) {
  return `根据当前知识库：${content.replace(/\n+/g, " ").slice(0, 220)}${content.length > 220 ? "…" : ""}`;
}

function append(workflow: WorkflowStep[], stage: WorkflowStage, detail: string) {
  workflow.push({ stage, detail });
}

function handoff(workflow: WorkflowStep[], tools: ToolResult[], detail: string) {
  append(workflow, "handoff_ready", detail);
  tools.push({ tool: "handoff_advice", status: "completed", summary: "已准备模拟人工转接所需的对话摘要与处理建议。" });
}

async function answerPolicyQuestion(message: string, workflow: WorkflowStep[], tools: ToolResult[], pythonRoute?: PythonAgentRoute) {
  append(workflow, "tool_invoked", pythonRoute ? "采用 FastAPI/LangGraph/Chroma 返回的公开证据，Node 网关保留回答与业务权限控制。" : "调用本地知识库检索工具，按语料级 TF-IDF/余弦相似度召回 Top-3 证据。" );
  const evidence = pythonRoute?.citations.length
    ? pythonRoute.citations.map((citation, index) => ({ documentId: -(index + 1), title: citation.title, content: citation.excerpt, sourceLabel: citation.sourceLabel, sourceUrl: citation.sourceUrl, score: citation.score }))
    : await db.searchKnowledgeBase(message);
  const grounding = decideGrounding(evidence, message);
  if (!grounding.grounded) {
    tools.push({ tool: "knowledge_search", status: "not_found", summary: "未检索到满足置信阈值的公开规则证据。" });
    handoff(workflow, tools, "知识库证据不足，阻止模型猜测并转入模拟人工支持。" );
    return {
      answer: "当前知识库没有足够依据回答这个问题。为避免猜测规则，我建议你转接人工支持，并提供订单记录或具体场景。",
      citations: [],
      handoff: true,
    };
  }

  tools.push({ tool: "knowledge_search", status: "completed", summary: `已召回 ${evidence.length} 条可引用规则证据。` });
  const evidenceText = evidence.map((item, index) => `证据 ${index + 1}（${item.sourceLabel}）：${item.content}`).join("\n\n");
  let answer = fallbackFromEvidence(evidence[0]!.content);
  try {
    const response = await invokeLLM({
      maxTokens: 260,
      messages: [
        {
          role: "system",
          content: "你是 CampusMate 的受控客服。只能根据给定证据回答；不能补充证据外的规则、法律判断、退款承诺或校方政策。若证据不足，回答必须建议人工支持。用简体中文，至多三句，不要伪造引用编号。",
        },
        { role: "user", content: `用户问题：${message}\n\n${evidenceText}` },
      ],
    });
    const content = response.choices[0]?.message.content;
    if (typeof content === "string" && content.trim()) answer = content.trim();
  } catch {
    // Evidence-grounded fallback keeps the response explainable if the model is unavailable.
  }
  append(workflow, "answer_generated", "基于检索证据生成受控回答，并返回可跳转的公开来源。" );
  return {
    answer,
    citations: evidence.map(item => ({ documentId: item.documentId, title: item.title, excerpt: item.content.slice(0, 240), sourceLabel: item.sourceLabel, sourceUrl: item.sourceUrl, score: item.score })),
    handoff: false,
  };
}

export async function answerCustomerMessage(input: { message: string; actor?: { id: number } }) {
  const workflow: WorkflowStep[] = [];
  const toolResults: ToolResult[] = [];
  const pythonRoute = await routeWithPythonAgent(input.message);
  const intent = pythonRoute?.intent ?? classifyCustomerIntent(input.message);
  if (pythonRoute) {
    workflow.push(...pythonRoute.workflow);
    append(workflow, "tool_invoked", "Node 网关接收 Python 路由结果；个人数据工具仍需经过 OAuth 会话校验。" );
  } else {
    append(workflow, "received", "接收用户问题，进入受控客服工作流。" );
    append(workflow, "intent_routed", `本地安全回退识别意图：${intent}。` );
  }

  if (intent === "human_handoff") {
    handoff(workflow, toolResults, "用户主动请求人工支持。" );
    return { intent, answer: "已为你准备模拟人工支持。请补充商品链接、订单编号（如有）、商品描述和你希望解决的问题；当前演示站不会发起真实人工工单。", citations: [], handoff: true, workflow, toolResults };
  }

  if (intent === "product_search") {
    append(workflow, "tool_invoked", "调用演示商品检索工具，仅搜索可下单商品。" );
    const products = await db.listProducts({ query: input.message, status: "active", limit: 3 });
    if (products.length === 0) {
      toolResults.push({ tool: "product_search", status: "not_found", summary: "演示目录中没有匹配的可下单商品。" });
      handoff(workflow, toolResults, "商品检索无结果，准备人工支持建议。" );
      return { intent, answer: "当前演示目录没有找到匹配的可下单商品。你可以换一个关键词，或转接人工支持。", citations: [], handoff: true, products: [], workflow, toolResults };
    }
    toolResults.push({ tool: "product_search", status: "completed", summary: `找到 ${products.length} 件可下单的演示商品。` });
    append(workflow, "answer_generated", "根据商品检索结果生成引导回答。" );
    return { intent, answer: `我找到了 ${products.length} 件可下单的演示商品。你可以打开商品详情查看成色、描述与模拟下单入口。`, citations: [], handoff: false, products, workflow, toolResults };
  }

  if (intent === "own_order") {
    append(workflow, "tool_invoked", "请求本人订单工具；工具只能从已验证会话读取当前账户。" );
    if (!input.actor) {
      toolResults.push({ tool: "own_order_lookup", status: "blocked", summary: "未检测到登录会话，订单工具未执行。" });
      append(workflow, "answer_generated", "返回登录门槛说明，不泄露任何订单数据。" );
      return { intent, answer: "订单查询需要先登录。登录后我只能读取你自己的模拟订单，无法查看其他账户的数据。", citations: [], handoff: false, requiresLogin: true, workflow, toolResults };
    }
    const orderId = extractOrderId(input.message);
    if (orderId) {
      const result = await db.getOrderForActor({ orderId, actorUserId: input.actor.id, isAdmin: false });
      if (result.kind === "missing") {
        toolResults.push({ tool: "own_order_lookup", status: "not_found", summary: "当前账户下未找到该模拟订单。" });
        append(workflow, "answer_generated", "返回订单不存在的安全说明。" );
        return { intent, answer: "没有找到这笔模拟订单。请确认订单编号，或在“我的订单”中查看。", citations: [], handoff: false, workflow, toolResults };
      }
      if (result.kind === "denied") {
        toolResults.push({ tool: "own_order_lookup", status: "blocked", summary: "订单所有权校验未通过，读取被拒绝并写入审计。" });
        handoff(workflow, toolResults, "检测到越权订单读取请求，拒绝返回数据。" );
        return { intent, answer: "我不能查看其他账户的订单；这次请求已记录为安全审计事件。", citations: [], handoff: true, workflow, toolResults };
      }
      toolResults.push({ tool: "own_order_lookup", status: "completed", summary: `已读取当前账户的订单 ${result.order.orderCode}。` });
      append(workflow, "answer_generated", "订单所有权通过后，返回当前会话可见的状态摘要。" );
      return { intent, answer: `已找到你的模拟订单 ${result.order.orderCode}，当前状态为 ${result.order.status}。订单数据仅在本次已验证会话中返回。`, citations: [], handoff: false, order: result.order, workflow, toolResults };
    }
    const orders = await db.listOrdersForUser(input.actor.id);
    toolResults.push({ tool: "own_order_lookup", status: "completed", summary: `已读取当前账户的 ${orders.length} 笔模拟订单。` });
    append(workflow, "answer_generated", "返回当前账户订单数量与下一步查询提示。" );
    return { intent, answer: orders.length ? `你当前有 ${orders.length} 笔模拟订单。请提供“订单 订单号”以查询具体订单。` : "你还没有模拟订单。你可以先浏览商品并完成一次演示下单。", citations: [], handoff: false, orders, workflow, toolResults };
  }

  const policy = await answerPolicyQuestion(input.message, workflow, toolResults, pythonRoute ?? undefined);
  return { intent, ...policy, workflow, toolResults };
}
