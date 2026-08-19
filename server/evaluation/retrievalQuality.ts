import { demoKnowledgeDocuments } from "../rag/demoKnowledge";
import { chunkText, searchChunks, vectorize, type SearchableChunk } from "../rag/retrieval";

export const fixedRetrievalCases = [
  { id: "listing-restrictions", question: "哪些商品不能上架？", expectedDocumentIndex: 0 },
  { id: "refund-policy", question: "签收后可以无理由退换吗？", expectedDocumentIndex: 1 },
  { id: "order-visibility", question: "模拟订单只对谁可见？", expectedDocumentIndex: 1 },
  { id: "listing-disclosure", question: "卖家需要写清楚哪些信息？", expectedDocumentIndex: 2 },
  { id: "cross-account-order", question: "客服能不能查其他同学的订单？", expectedDocumentIndex: 2 },
  { id: "unknown-question", question: "知识库没有提到的问题怎么办？", expectedDocumentIndex: 2 },
] as const;

export type RetrievalObservation = {
  id: string;
  question: string;
  expectedDocumentTitle: string;
  firstRelevantRank: number | null;
  retrievedDocumentTitles: string[];
  latencyMs: number;
};

export function buildDemoRetrievalChunks(): SearchableChunk[] {
  return demoKnowledgeDocuments.flatMap((document, documentIndex) => chunkText(document.content).map((content, chunkIndex) => ({
    id: documentIndex * 100 + chunkIndex + 1,
    documentId: documentIndex + 1,
    title: document.title,
    content,
    sourceLabel: document.sourceLabel,
    sourceUrl: document.sourceUrl,
    vector: vectorize(content),
  })));
}

export function runFixedRetrievalQualityEvaluation(k = 3) {
  const chunks = buildDemoRetrievalChunks();
  const observations: RetrievalObservation[] = fixedRetrievalCases.map(testCase => {
    const startedAt = performance.now();
    const results = searchChunks(testCase.question, chunks, chunks.length);
    const firstRelevantIndex = results.findIndex(result => result.documentId === testCase.expectedDocumentIndex + 1);
    return {
      id: testCase.id,
      question: testCase.question,
      expectedDocumentTitle: demoKnowledgeDocuments[testCase.expectedDocumentIndex].title,
      firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
      retrievedDocumentTitles: results.slice(0, k).map(result => result.title),
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    };
  });
  const caseCount = observations.length;
  const recallAtK = Math.round(observations.filter(item => item.firstRelevantRank !== null && item.firstRelevantRank <= k).length / caseCount * 100);
  const meanReciprocalRank = Math.round(observations.reduce((sum, item) => sum + (item.firstRelevantRank ? 1 / item.firstRelevantRank : 0), 0) / caseCount * 100);
  const averageLatencyMs = Number((observations.reduce((sum, item) => sum + item.latencyMs, 0) / caseCount).toFixed(2));
  return { k, caseCount, recallAtK, meanReciprocalRank, averageLatencyMs, observations };
}
