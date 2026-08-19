import { tokenize } from "../rag/retrieval";

export type GroundingEvidence = { documentId: number; title: string; content: string; sourceLabel: string; sourceUrl: string; score: number };

const genericTokens = new Set(["什么", "需要", "可以", "如何", "是否", "一下", "请问", "这个", "那个", "问题", "帮我"]);

function hasMeaningfulCoverage(question: string, evidence: GroundingEvidence[]) {
  const meaningfulTokens = tokenize(question).filter(token => !genericTokens.has(token));
  if (meaningfulTokens.length === 0) return false;
  const sourceText = evidence.map(item => item.content).join("\n");
  return meaningfulTokens.some(token => sourceText.includes(token));
}

export function decideGrounding(evidence: GroundingEvidence[], question = "", threshold = 0.075) {
  const confidence = evidence[0]?.score ?? 0;
  if (confidence < threshold || (question && !hasMeaningfulCoverage(question, evidence))) return { grounded: false as const, handoff: true, confidence, citations: [] as GroundingEvidence[] };
  return { grounded: true as const, handoff: false, confidence, citations: evidence };
}
