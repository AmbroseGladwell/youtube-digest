import type { CaptureFailure } from "@overview/domain";
import { GenerationError } from "@overview/generation";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";

// A failed run by name, never by its message, which can quote a provider's own words
// (docs/architecture/analytics.md, "What an event may carry"). Once the transcript is in
// hand, whatever fails is the generation, however its client chose to throw.
export function captureFailureOf(error: unknown, { transcriptResolved }: { transcriptResolved: boolean }): CaptureFailure {
  if (error instanceof TranscriptFetchError) return error.failure;
  if (error instanceof NoTranscriptSourceError) return "noTranscriptSource";
  if (error instanceof GenerationError || transcriptResolved) return "generation";
  return "unknown";
}
