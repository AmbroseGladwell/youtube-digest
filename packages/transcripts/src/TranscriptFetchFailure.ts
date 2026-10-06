// Why a transcript could not be fetched, named rather than inferred from a provider's
// own error type. The ladder decides what to do next by reading this
// (docs/features/transcript-retrieval.md).
export const TranscriptFetchFailure = {
  NO_CAPTIONS: "no-captions",
  VIDEO_UNAVAILABLE: "video-unavailable",
  ACCESS_RESTRICTED: "access-restricted",
  SOURCE_BLOCKED: "source-blocked",
  RATE_LIMITED: "rate-limited",
  SOURCE_UNAVAILABLE: "source-unavailable",
  MALFORMED_RESPONSE: "malformed-response",
  SOURCE_UNSUPPORTED: "source-unsupported",
  // Our own service has spent today's proxy budget: nothing about the video, and not worth
  // retrying until tomorrow (docs/architecture/server-side-transcripts.md).
  BUDGET_EXHAUSTED: "budget-exhausted",
  // Our own service has reached this caller's daily safety cap: nothing about the video, and
  // the extension can still fetch it (docs/architecture/server-side-transcripts.md).
  DAILY_CAP: "daily-cap",
} as const;

export type TranscriptFetchFailure =
  (typeof TranscriptFetchFailure)[keyof typeof TranscriptFetchFailure];

const RETRYABLE: ReadonlySet<TranscriptFetchFailure> = new Set([
  TranscriptFetchFailure.RATE_LIMITED,
  TranscriptFetchFailure.SOURCE_UNAVAILABLE,
]);

export const isRetryableFailure = (failure: TranscriptFetchFailure): boolean =>
  RETRYABLE.has(failure);

// A failure that says nothing about the video, only about this source's ability to
// answer for it, so the next rung is worth asking.
const WORTH_ANOTHER_SOURCE: ReadonlySet<TranscriptFetchFailure> = new Set([
  TranscriptFetchFailure.NO_CAPTIONS,
  TranscriptFetchFailure.ACCESS_RESTRICTED,
  TranscriptFetchFailure.SOURCE_BLOCKED,
  TranscriptFetchFailure.SOURCE_UNAVAILABLE,
  TranscriptFetchFailure.MALFORMED_RESPONSE,
  TranscriptFetchFailure.SOURCE_UNSUPPORTED,
  TranscriptFetchFailure.RATE_LIMITED,
  TranscriptFetchFailure.BUDGET_EXHAUSTED,
  TranscriptFetchFailure.DAILY_CAP,
]);

export const isWorthAnotherSource = (failure: TranscriptFetchFailure): boolean =>
  WORTH_ANOTHER_SOURCE.has(failure);
