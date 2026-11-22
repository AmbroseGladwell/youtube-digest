import type { TranscriptSource } from "../types/TranscriptSource.js";

// Why free only: docs/features/transcript-retrieval.md, "The background prefetch spends nothing, structurally".
export const freeTranscriptSources = (sources: TranscriptSource[]): TranscriptSource[] =>
  sources.filter((source) => source.cost === "free");
