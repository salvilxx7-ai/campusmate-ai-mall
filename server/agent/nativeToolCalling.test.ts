import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "../_core/llm";
import { measureCustomerToolSelection, selectCustomerToolWithFunctionCalling } from "./nativeToolCalling";

const mockedInvokeLLM = vi.mocked(invokeLLM);
const originalFlag = process.env.CAMPUSMATE_NATIVE_TOOLS;

afterEach(() => {
  process.env.CAMPUSMATE_NATIVE_TOOLS = originalFlag;
  mockedInvokeLLM.mockReset();
});

describe("native customer function calling", () => {
  it("validates an LLM-selected catalog tool before Node executes it", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "call_catalog", type: "function", function: { name: "search_catalog", arguments: JSON.stringify({ query: "二手教材" }) } }] } }] } as never);
    await expect(selectCustomerToolWithFunctionCalling({ message: "有二手教材吗？", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toEqual({ kind: "search_catalog", query: "二手教材" });
    expect(mockedInvokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-nano", maxCompletionTokens: 600, toolChoice: "auto", tools: expect.any(Array) }));
  });

  it("refuses a ticket tool call when the caller has not authenticated", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "call_ticket", type: "function", function: { name: "create_support_ticket", arguments: JSON.stringify({ category: "other", summary: "请求人工支持" }) } }] } }] } as never);
    await expect(selectCustomerToolWithFunctionCalling({ message: "帮我转人工", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toBeUndefined();
  });

  it("records a structured success measurement for catalog tool selection", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "call_catalog", type: "function", function: { name: "search_catalog", arguments: JSON.stringify({ query: "教材" }) } }] } }] } as never);
    await expect(measureCustomerToolSelection({ message: "找教材", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toMatchObject({ selectedTool: "search_catalog", outcome: "success", authorization: "allowed" });
  });

  it("records a blocked measurement when an unauthenticated caller asks for an own-order tool", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "call_order", type: "function", function: { name: "own_order_lookup", arguments: "{}" } }] } }] } as never);
    await expect(measureCustomerToolSelection({ message: "查询我的订单", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toMatchObject({ selectedTool: "fallback", outcome: "fallback", authorization: "blocked" });
  });

  it("records a blocked measurement when an unauthenticated caller asks to create a handoff ticket", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "call_ticket", type: "function", function: { name: "create_support_ticket", arguments: JSON.stringify({ category: "other", summary: "请求人工支持" }) } }] } }] } as never);
    await expect(measureCustomerToolSelection({ message: "我要转人工提交工单", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toMatchObject({ selectedTool: "fallback", outcome: "fallback", authorization: "blocked" });
  });

  it("records a fallback measurement when the model does not select a tool", async () => {
    process.env.CAMPUSMATE_NATIVE_TOOLS = "true";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "请查看规则说明" } }] } as never);
    await expect(measureCustomerToolSelection({ message: "什么商品不能上架？", canAccessOwnOrder: false, canCreateTicket: false })).resolves.toMatchObject({ selectedTool: "fallback", outcome: "fallback", authorization: "not_required" });
  });
});
