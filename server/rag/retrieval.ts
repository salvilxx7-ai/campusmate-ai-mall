export type TokenVector = Record<string, number>;

export type SearchableChunk = {
  id: number;
  documentId: number;
  title: string;
  content: string;
  sourceLabel: string;
  sourceUrl: string;
  vector: TokenVector;
};

const normalize = (value: string) => value.toLocaleLowerCase("zh-CN").replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "");

export function tokenize(value: string) {
  const text = normalize(value);
  const tokens: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const pair = text.slice(index, index + 2);
    if (pair.length === 2) tokens.push(pair);
  }
  return tokens;
}

export function vectorize(value: string): TokenVector {
  return normalizeVector(termCounts(value));
}

function termCounts(value: string): TokenVector {
  const counts: TokenVector = {};
  for (const token of tokenize(value)) counts[token] = (counts[token] ?? 0) + 1;
  return counts;
}

function normalizeVector(counts: TokenVector): TokenVector {
  const magnitude = Math.sqrt(Object.values(counts).reduce((sum, count) => sum + count ** 2, 0));
  if (magnitude === 0) return counts;
  return Object.fromEntries(Object.entries(counts).map(([token, count]) => [token, Number((count / magnitude).toFixed(8))]));
}

export function buildInverseDocumentFrequency(texts: string[]) {
  const documentFrequency: Record<string, number> = {};
  for (const text of texts) {
    const uniqueTokens = Object.keys(termCounts(text));
    for (const token of uniqueTokens) documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
  }
  const totalDocuments = Math.max(texts.length, 1);
  return Object.fromEntries(Object.entries(documentFrequency).map(([token, count]) => [token, Math.log((totalDocuments + 1) / (count + 1)) + 1]));
}

export function tfIdfVector(value: string, idf: TokenVector): TokenVector {
  const weighted = Object.fromEntries(Object.entries(termCounts(value)).map(([token, count]) => [token, count * (idf[token] ?? 0)]));
  return normalizeVector(weighted);
}

export function cosineSimilarity(left: TokenVector, right: TokenVector) {
  let total = 0;
  for (const [token, value] of Object.entries(left)) total += value * (right[token] ?? 0);
  return total;
}

export function chunkText(content: string, size = 240) {
  const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > size) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function searchChunks(question: string, chunks: SearchableChunk[], limit = 3) {
  const idf = buildInverseDocumentFrequency(chunks.map(chunk => chunk.content));
  const queryVector = tfIdfVector(question, idf);
  return chunks
    .map(chunk => ({ ...chunk, score: Number(cosineSimilarity(queryVector, tfIdfVector(chunk.content, idf)).toFixed(4)) }))
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
