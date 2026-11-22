import type { Provider, TranscriptionFailure } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";

// A chosen model's failure gets our own words, never the provider's response (OV-247).
export type RunError =
  | { kind: "message"; message: string }
  | { kind: "chosenModel"; provider: Provider; model: string }
  | { kind: "articleFetch"; failure: ArticleFailure; url: string; regenerating: boolean }
  | { kind: "podcastNoTranscript" }
  // Asked before anything is spent.
  | { kind: "podcastNeedsTranscribing" }
  | { kind: "transcriptionFailed"; reason: TranscriptionFailure | "no-audio" }
  | { kind: "transcriptionRefused"; refusal: "not-enough" | "too-long"; episodeSeconds: number | null };
