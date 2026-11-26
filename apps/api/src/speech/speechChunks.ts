const LATER_CHUNK_SENTENCES = 3;

// The first sentence alone, so it plays soonest; the rest in threes, so readers take turns.
export const speechChunks = <T>(sentences: readonly T[]): T[][] => {
  const [first, ...rest] = sentences;
  if (first === undefined) {
    return [];
  }
  const chunks: T[][] = [[first]];
  for (let at = 0; at < rest.length; at += LATER_CHUNK_SENTENCES) {
    chunks.push(rest.slice(at, at + LATER_CHUNK_SENTENCES));
  }
  return chunks;
};
