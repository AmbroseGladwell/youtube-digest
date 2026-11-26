export interface ChunkSizing {
  firstCharacters: number;
  growth: number;
  mostCharacters: number;
}

// About 3 s of speech first; then each chunk what the voice makes while the last one plays (3.2x on performance-4x).
export const DEFAULT_CHUNK_SIZING: ChunkSizing = { firstCharacters: 70, growth: 2.5, mostCharacters: 600 };

// Whole sentences only, so the highlight lines up: docs/features/chat-read-aloud.md, "The live lane".
export const speechChunks = <T>(sentences: readonly T[], lengthOf: (sentence: T) => number, sizing: ChunkSizing): T[][] => {
  const chunks: T[][] = [];
  let chunk: T[] = [];
  let length = 0;
  let budget = sizing.firstCharacters;
  const close = () => {
    chunks.push(chunk);
    budget = Math.min(sizing.mostCharacters, Math.max(sizing.firstCharacters, length * sizing.growth));
    chunk = [];
    length = 0;
  };
  for (const sentence of sentences) {
    const size = lengthOf(sentence);
    const first = chunks.length === 0;
    if (!first && chunk.length > 0 && length + size > budget) {
      close();
    }
    chunk.push(sentence);
    length += size;
    if (first && length >= budget) {
      close();
    }
  }
  if (chunk.length > 0) {
    chunks.push(chunk);
  }
  return chunks;
};
