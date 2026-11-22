import { TranscriptFetchError } from "@overview/transcripts";
import type { TranscriptSourceFailure } from "../api/NoTranscriptSourceError.js";

const NOTHING_TO_ASK = "Nothing here can fetch a transcript.";
const NONE_ANSWERED = "No transcript source could fetch this video.";

export const transcriptFailureMessage = (failures: TranscriptSourceFailure[]): string => {
  const attempted = failures.filter((failure) => failure.outcome !== "unavailable");
  if (attempted.length === 0) {
    return NOTHING_TO_ASK;
  }

  const lastError = attempted
    .map((failure) => failure.error)
    .filter((error): error is TranscriptFetchError => error instanceof TranscriptFetchError)
    .at(-1);

  return lastError?.message ?? NONE_ANSWERED;
};
