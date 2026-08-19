import { describe, expect, it } from "vitest";
import { calculateEvaluationMetrics } from "./metrics";

describe("evaluation metrics", () => {
  it("computes reproducible percentages and average latency from fixed observations", () => {
    expect(calculateEvaluationMetrics([
      { intentMatched: true, citationComplete: true, refusalCorrect: true, latencyMs: 10 },
      { intentMatched: true, citationComplete: false, refusalCorrect: true, latencyMs: 20 },
    ])).toEqual({ caseCount: 2, intentAccuracy: 100, citationCompleteness: 50, refusalCorrectness: 100, averageLatencyMs: 15 });
  });
});
