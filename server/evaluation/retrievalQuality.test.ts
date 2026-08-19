import { describe, expect, it } from "vitest";
import { runFixedRetrievalQualityEvaluation } from "./retrievalQuality";

describe("fixed retrieval-quality evaluation", () => {
  it("computes deterministic Recall@K and MRR from source-backed demo rule questions", () => {
    const result = runFixedRetrievalQualityEvaluation(3);
    expect(result.caseCount).toBe(6);
    expect(result.observations).toHaveLength(6);
    expect(result.recallAtK).toBeGreaterThanOrEqual(80);
    expect(result.meanReciprocalRank).toBeGreaterThanOrEqual(70);
    expect(result.observations.every(item => item.firstRelevantRank !== null)).toBe(true);
  });
});
