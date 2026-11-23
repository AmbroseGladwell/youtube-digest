import type { Provider, TranscribedSource, TranscriptionFailure } from "@overview/domain";
import type { NoSpeechReason } from "@overview/generation";
import type { ArticleFailure } from "../api/ArticleReadError.js";

// A chosen model's failure gets our own words, never the provider's response (OV-247).
export type RunError =
  | { kind: "message"; message: string }
  | { kind: "chosenModel"; provider: Provider; model: string }
  | { kind: "articleFetch"; failure: ArticleFailure; url: string; regenerating: boolean }
  | { kind: "podcastNoTranscript" }
  // Stopped before a note was written, by the word floor or the kind check (130f, 130f-2).
  | { kind: "noSpeech"; reason: NoSpeechReason }
  // Asked before anything is spent.
  | { kind: "podcastNeedsTranscribing" }
  | { kind: "transcriptionFailed"; reason: TranscriptionFailure | "no-audio"; source: TranscribedSource }
  | { kind: "transcriptionRefused"; refusal: "not-enough" | "too-long"; episodeSeconds: number | null };
