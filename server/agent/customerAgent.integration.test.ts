import { describe, expect, it } from "vitest";
import { answerCustomerMessage } from "./customerAgent";

describe("customer-service response flow", () => {
  it("returns grounded policy citations in the actual customer-service payload", async () => {
    const result = await answerCustomerMessage({ message: "什么商品不能上架？" });
    expect(result.intent).toBe("policy_qa");
    expect(result.handoff).toBe(false);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]).toMatchObject({ title: expect.any(String), sourceUrl: expect.stringContaining("http"), excerpt: expect.any(String) });
  });

  it("returns a human-handoff payload when the actual retrieval flow lacks meaningful coverage", async () => {
    const result = await answerCustomerMessage({ message: "星际旅行需要带什么？" });
    expect(result).toMatchObject({ intent: "policy_qa", handoff: true, citations: [] });
  });
});
