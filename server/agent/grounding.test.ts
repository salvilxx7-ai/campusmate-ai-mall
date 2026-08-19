import { describe, expect, it } from "vitest";
import { decideGrounding } from "./grounding";

const evidence = [{ documentId: 1, title: "安全交易 FAQ", content: "禁止发布危险商品。", sourceLabel: "演示规则", sourceUrl: "https://example.com/rules", score: 0.22 }];

describe("grounded customer-service evidence decision", () => {
  it("returns citations when retrieval clears the evidence threshold", () => {
    expect(decideGrounding(evidence)).toMatchObject({ grounded: true, handoff: false, citations: evidence });
  });

  it("forces human handoff without citations when retrieval is below threshold", () => {
    expect(decideGrounding([{ ...evidence[0], score: 0.02 }])).toEqual({ grounded: false, handoff: true, confidence: 0.02, citations: [] });
  });

  it("forces handoff when a high score is driven only by generic question language", () => {
    expect(decideGrounding([{ ...evidence[0], content: "请问需要协商什么？", score: 0.2 }], "星际旅行需要带什么？")).toMatchObject({ grounded: false, handoff: true, citations: [] });
  });
});
