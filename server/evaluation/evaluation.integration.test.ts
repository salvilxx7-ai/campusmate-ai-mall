import { describe, expect, it } from "vitest";
import { getEvaluationOverview, runFixedEvaluation } from "../db";

describe("fixed evaluation end to end", () => {
  it("runs the persisted fixed case set and exposes recorded metrics", async () => {
    const result = await runFixedEvaluation();
    expect(result.metrics.caseCount).toBe(5);
    expect(result.metrics.intentAccuracy).toBe(100);
    expect(result.metrics.citationCompleteness).toBe(100);
    expect(result.metrics.refusalCorrectness).toBe(100);

    const overview = await getEvaluationOverview();
    expect(overview.cases).toHaveLength(5);
    expect(overview.metrics.caseCount).toBe(5);
    expect(overview.lastRunAt).not.toBeNull();
  });
});
