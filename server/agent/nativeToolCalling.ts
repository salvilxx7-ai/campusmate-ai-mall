import { invokeLLM, type Tool } from "../_core/llm";

export type NativeCustomerToolCall =
  | { kind: "search_catalog"; query: string }
  | { kind: "own_order_lookup"; orderId?: number }
  | { kind: "create_support_ticket"; category: "policy" | "order" | "security" | "other"; summary: string };

export type NativeToolMeasurement = {
  selectedTool: NativeCustomerToolCall["kind"] | "fallback";
  outcome: "success" | "fallback";
  authorization: "allowed" | "blocked" | "not_required";
  latencyMs: number;
};

const customerTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "在 CampusMate 的公开演示商品目录中查找用户想要的物品。",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "用于商品检索的简短关键词" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "own_order_lookup",
      description: "查询当前已验证会话自己的模拟订单，绝不查询其他账户。",
      parameters: {
        type: "object",
        properties: { orderId: { type: "integer", description: "用户提及的可选订单编号" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "当用户明确要求人工支持、投诉或知识库无法覆盖时，为已登录用户创建模拟人工工单。",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["policy", "order", "security", "other"] },
          summary: { type: "string", description: "不含个人敏感信息的工单摘要" },
        },
        required: ["category", "summary"],
        additionalProperties: false,
      },
    },
  },
];

function parseArguments(raw: string) {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return value && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The model may choose a named tool, but Node always validates arguments and
 * executes the tool locally. No user id, cookie, order data, or secret is sent
 * to the model.
 */
export async function selectCustomerToolWithFunctionCalling(input: { message: string; canAccessOwnOrder: boolean; canCreateTicket: boolean }) {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST === "true") && process.env.CAMPUSMATE_NATIVE_TOOLS !== "true") return undefined;
  try {
    const response = await invokeLLM({
      model: "gpt-5-nano",
      maxCompletionTokens: 600,
      tools: customerTools,
      toolChoice: "auto",
      messages: [
        {
          role: "system",
          content: "你是 CampusMate 的工具选择器。仅在商品查找、本人订单查询或用户明确请求人工支持时选择一个工具；规则问答不调用工具。不能猜测订单数据。若用户未登录，不能选择本人订单或创建工单。",
        },
        { role: "user", content: `用户问题：${input.message}\n本人订单可用：${input.canAccessOwnOrder ? "是" : "否"}\n工单创建可用：${input.canCreateTicket ? "是" : "否"}` },
      ],
    });
    const call = response.choices[0]?.message.tool_calls?.[0];
    const args = call ? parseArguments(call.function.arguments) : undefined;
    if (!call || !args) return undefined;
    if (call.function.name === "search_catalog" && typeof args.query === "string" && args.query.trim()) {
      return { kind: "search_catalog" as const, query: args.query.trim().slice(0, 160) };
    }
    if (call.function.name === "own_order_lookup" && input.canAccessOwnOrder) {
      const orderId = typeof args.orderId === "number" && Number.isInteger(args.orderId) && args.orderId > 0 ? args.orderId : undefined;
      return { kind: "own_order_lookup" as const, orderId };
    }
    if (call.function.name === "create_support_ticket" && input.canCreateTicket && typeof args.summary === "string") {
      const category = ["policy", "order", "security", "other"].includes(String(args.category)) ? args.category as "policy" | "order" | "security" | "other" : "other";
      return { kind: "create_support_ticket" as const, category, summary: args.summary.trim().slice(0, 500) || "用户请求模拟人工支持" };
    }
  } catch (error) {
    console.warn("[CustomerAgent] Native tool selection unavailable; falling back to deterministic routing.", error instanceof Error ? error.message : error);
  }
  return undefined;
}

/** A structured, non-persistent measurement for reproducible tool-selection evidence. */
export async function measureCustomerToolSelection(input: { message: string; canAccessOwnOrder: boolean; canCreateTicket: boolean }): Promise<NativeToolMeasurement> {
  const startedAt = performance.now();
  const selected = await selectCustomerToolWithFunctionCalling(input);
  const latencyMs = Number((performance.now() - startedAt).toFixed(2));
  if (selected) return { selectedTool: selected.kind, outcome: "success", authorization: "allowed", latencyMs };
  const authorization = !input.canAccessOwnOrder && /订单|订单号|下单|我的订单|取货码/.test(input.message)
    ? "blocked"
    : !input.canCreateTicket && /人工|真人|投诉|转接|客服专员|工单/.test(input.message)
      ? "blocked"
      : "not_required";
  return { selectedTool: "fallback", outcome: "fallback", authorization, latencyMs };
}
