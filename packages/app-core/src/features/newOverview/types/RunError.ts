import type { Provider, TranscriptionFailure } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";

// What a failed run tells the reader. A model they chose gets our own words and a way to
// change it, never the provider's response (OV-247). An article our server couldn't fetch
// gets the same words a pasted link does (OV-285).
export type RunError =
  | { kind: "message"; message: string }
  | { kind: "chosenModel"; provider: Provider; model: string }
  | { kind: "articleFetch"; failure: ArticleFailure; url: string; regenerating: boolean }
  // An episode whose words weren't found: common, and nothing was used (design 106h).
  | { kind: "podcastNoTranscript" }
  // None found after Create, where our server would transcribe it: asked before anything is spent
  // (design 305c-2).
  | { kind: "podcastNeedsTranscribing" }
  // A transcription the reader chose ended without words, and counted nothing (design 305k).
  | { kind: "transcriptionFailed"; reason: TranscriptionFailure | "no-audio" }
  // One our server wouldn't start after all (designs 305h, 305j).
  | { kind: "transcriptionRefused"; refusal: "not-enough" | "too-long"; episodeSeconds: number | null };
