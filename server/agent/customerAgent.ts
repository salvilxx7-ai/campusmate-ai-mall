import * as db from "../db";
import { invokeLLM } from "../_core/llm";
import { decideGrounding } from "./grounding";

export type CustomerIntent = "policy_qa" | "product_search" | "own_order" | "human_handoff";

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

async function answerPolicyQuestion(message: string) {
  const evidence = await db.searchKnowledgeBase(message);
  const grounding = decideGrounding(evidence, message);
  if (!grounding.grounded) {
    return {
      answer: "当前知识库没有足够依据回答这个问题。为避免猜测规则，我建议你转接人工支持，并提供订单记录或具体场景。",
      citations: [],
      handoff: true,
      confidence: grounding.confidence,
    };
  }

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
    // The evidence-grounded fallback keeps the support flow available if the model is temporarily unavailable.
  }
  return {
    answer,
    citations: evidence.map(item => ({ documentId: item.documentId, title: item.title, excerpt: item.content.slice(0, 240), sourceLabel: item.sourceLabel, sourceUrl: item.sourceUrl, score: item.score })),
    handoff: false,
    confidence: grounding.confidence,
  };
}

export async function answerCustomerMessage(input: { message: string; actor?: { id: number } }) {
  const intent = classifyCustomerIntent(input.message);
  if (intent === "human_handoff") {
    return { intent, answer: "已为你转入人工支持建议。请准备商品链接、订单编号（如有）、商品描述和你希望解决的问题；当前演示站不会发起真实人工工单。", citations: [], handoff: true };
  }
  if (intent === "product_search") {
    const products = await db.listProducts({ query: input.message, status: "active", limit: 3 });
    if (products.length === 0) return { intent, answer: "当前演示目录没有找到匹配的可下单商品。你可以换一个关键词，或转接人工支持。", citations: [], handoff: true, products: [] };
    return { intent, answer: `我找到了 ${products.length} 件可下单的演示商品。你可以打开商品详情查看成色、描述与模拟下单入口。`, citations: [], handoff: false, products };
  }
  if (intent === "own_order") {
    if (!input.actor) return { intent, answer: "订单查询需要先登录。登录后我只能读取你自己的模拟订单，无法查看其他账户的数据。", citations: [], handoff: false, requiresLogin: true };
    const orderId = extractOrderId(input.message);
    if (orderId) {
      const result = await db.getOrderForActor({ orderId, actorUserId: input.actor.id, isAdmin: false });
      if (result.kind === "missing") return { intent, answer: "没有找到这笔模拟订单。请确认订单编号，或在“我的订单”中查看。", citations: [], handoff: false };
      if (result.kind === "denied") return { intent, answer: "我不能查看其他账户的订单；这次请求已记录为安全审计事件。", citations: [], handoff: true };
      return { intent, answer: `已找到你的模拟订单 ${result.order.orderCode}，当前状态为 ${result.order.status}。订单数据仅在本次已验证会话中返回。`, citations: [], handoff: false, order: result.order };
    }
    const orders = await db.listOrdersForUser(input.actor.id);
    return { intent, answer: orders.length ? `你当前有 ${orders.length} 笔模拟订单。请提供“订单 订单号”以查询具体订单。` : "你还没有模拟订单。你可以先浏览商品并完成一次演示下单。", citations: [], handoff: false, orders };
  }
  return { intent, ...(await answerPolicyQuestion(input.message)) };
}
