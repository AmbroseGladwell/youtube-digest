import type { TranscriptSource } from "../types/TranscriptSource.js";

// Handed to the background prefetch instead of the whole ladder, so "nothing is bought
// for a video nobody asked about" is a property of what it can reach rather than a rule
// someone has to remember (docs/features/transcript-retrieval.md).
export const freeTranscriptSources = (sources: TranscriptSource[]): TranscriptSource[] =>
  sources.filter((source) => source.cost === "free");
