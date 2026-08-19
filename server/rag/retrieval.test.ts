import { describe, expect, it } from "vitest";
import { buildInverseDocumentFrequency, chunkText, searchChunks, vectorize } from "./retrieval";

const chunks = [
  { id: 1, documentId: 1, title: "售后说明", content: "签收后不默认支持无理由退换，已有约定优先。", sourceLabel: "售后说明", sourceUrl: "https://example.com/a", vector: vectorize("签收后不默认支持无理由退换，已有约定优先。") },
  { id: 2, documentId: 2, title: "上架原则", content: "禁止上架危险品和侵权商品。", sourceLabel: "上架原则", sourceUrl: "https://example.com/b", vector: vectorize("禁止上架危险品和侵权商品。") },
];

describe("deterministic RAG retrieval", () => {
  it("splits knowledge text into stable paragraphs", () => {
    expect(chunkText("第一段内容。\n\n第二段内容。", 10)).toEqual(["第一段内容。", "第二段内容。"]) 
  });

  it("returns the most relevant evidence with a score", () => {
    const result = searchChunks("签收以后能不能无理由退货？", chunks);
    expect(result[0]?.documentId).toBe(1);
    expect(result[0]?.score).toBeGreaterThan(0);
  });

  it("returns no fabricated evidence for unrelated questions", () => {
    expect(searchChunks("星际旅行需要带什么？", chunks)).toEqual([]);
  });

  it("uses corpus-level IDF to promote the chunk that contains a rare matched term", () => {
    const commonChunks = Array.from({ length: 40 }, (_, index) => ({ id: index + 10, documentId: index + 10, title: "公共说明", content: "公共 公共 公共 公共", sourceLabel: "公共说明", sourceUrl: "https://example.com/common", vector: vectorize("公共 公共 公共 公共") }));
    const rareChunk = { id: 99, documentId: 99, title: "特殊说明", content: "公共 稀有", sourceLabel: "特殊说明", sourceUrl: "https://example.com/rare", vector: vectorize("公共 稀有") };
    const idf = buildInverseDocumentFrequency([...commonChunks.map(chunk => chunk.content), rareChunk.content]);
    expect(idf["稀有"]).toBeGreaterThan(idf["公共"] ?? 0);
    expect(searchChunks("公共 公共 公共 公共 稀有", [...commonChunks, rareChunk])[0]?.id).toBe(99);
  });
});
