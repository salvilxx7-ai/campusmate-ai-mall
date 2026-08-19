export type EvaluationObservation = {
  intentMatched: boolean;
  citationComplete: boolean;
  refusalCorrect: boolean;
  latencyMs: number;
};

export function calculateEvaluationMetrics(observations: EvaluationObservation[]) {
  const total = observations.length;
  const ratio = (selector: (value: EvaluationObservation) => boolean) => total === 0 ? 0 : Math.round((observations.filter(selector).length / total) * 100);
  return {
    caseCount: total,
    intentAccuracy: ratio(value => value.intentMatched),
    citationCompleteness: ratio(value => value.citationComplete),
    refusalCorrectness: ratio(value => value.refusalCorrect),
    averageLatencyMs: total === 0 ? 0 : Math.round(observations.reduce((sum, value) => sum + value.latencyMs, 0) / total),
  };
}
