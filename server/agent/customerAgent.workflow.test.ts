import { describe, expect, it } from "vitest";
import { answerCustomerMessage } from "./customerAgent";

describe("customer-service explicit workflow", () => {
  it("returns a trace and a successful knowledge tool result for grounded policy questions", async () => {
    const result = await answerCustomerMessage({ message: "什么商品不能上架？" });
    expect(result.workflow.map(step => step.stage)).toEqual(expect.arrayContaining(["received", "intent_routed", "tool_invoked", "answer_generated"]));
    expect(result.toolResults).toContainEqual(expect.objectContaining({ tool: "knowledge_search", status: "completed" }));
  });

  it("records a handoff branch instead of fabricating evidence for unmatched questions", async () => {
    const result = await answerCustomerMessage({ message: "星际旅行需要带什么？" });
    expect(result.handoff).toBe(true);
    expect(result.workflow.at(-1)).toMatchObject({ stage: "handoff_ready" });
    expect(result.toolResults).toContainEqual(expect.objectContaining({ tool: "knowledge_search", status: "not_found" }));
  });
});
