import type { Passage } from "./transcriptPassages.js";

const cosine = (left: readonly number[], right: readonly number[]): number => {
  let dot = 0;
  let leftSize = 0;
  let rightSize = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftSize += a * a;
    rightSize += b * b;
  }
  return dot / (Math.sqrt(leftSize) * Math.sqrt(rightSize));
};

export const closestPassages = (
  passages: readonly Passage[],
  vectors: readonly (readonly number[])[],
  query: readonly number[],
  count: number,
): Passage[] => {
  return passages
    .map((passage, index) => ({ passage, similarity: cosine(vectors[index] ?? [], query) }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, count)
    .map(({ passage }) => passage)
    .sort((left, right) => left.startMs - right.startMs);
};
