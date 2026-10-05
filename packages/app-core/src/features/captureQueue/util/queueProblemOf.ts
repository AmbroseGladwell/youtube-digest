import type { QueuedCaptureProblem } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";

function fetchErrorOf(error: unknown): TranscriptFetchError | null {
  if (error instanceof TranscriptFetchError) return error;
  if (error instanceof NoTranscriptSourceError) {
    return (
      error.failures
        .map((failure) => failure.error)
        .filter((cause): cause is TranscriptFetchError => cause instanceof TranscriptFetchError)
        .at(-1) ?? null
    );
  }
  return null;
}

// What the reader is told about a video the queue could not make, by kind, never by a
// provider's own words. The ladder's last rung to answer says why
// (docs/features/capture-queue.md, "Needs attention").
export function queueProblemOf(error: unknown): QueuedCaptureProblem {
  const fetchError = fetchErrorOf(error);
  if (fetchError?.failure === "no-captions") return "noCaptions";
  if (fetchError?.failure === "video-unavailable" || fetchError?.failure === "access-restricted") return "unavailable";
  return "failed";
}
