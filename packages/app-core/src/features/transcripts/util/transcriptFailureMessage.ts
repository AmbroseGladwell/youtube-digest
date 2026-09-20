import { TranscriptFetchError } from "@overview/transcripts";
import type { TranscriptSourceFailure } from "../api/NoTranscriptSourceError.js";

const NOTHING_TO_ASK = "Nothing here can fetch a transcript.";
const NONE_ANSWERED = "No transcript source could fetch this video.";

// A reader is told what actually went wrong, not that a list was empty. A rung that was
// never ready says nothing useful about the video, so it is only the answer when it is the
// only thing that happened (docs/features/transcript-retrieval.md).
export function transcriptFailureMessage(failures: TranscriptSourceFailure[]): string {
  const attempted = failures.filter((failure) => failure.outcome !== "unavailable");
  if (attempted.length === 0) {
    return NOTHING_TO_ASK;
  }

  const lastError = attempted
    .map((failure) => failure.error)
    .filter((error): error is TranscriptFetchError => error instanceof TranscriptFetchError)
    .at(-1);

  return lastError?.message ?? NONE_ANSWERED;
}
