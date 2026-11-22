// docs/features/transcript-retrieval.md, "Failure is data, not a provider's error type".
export const TranscriptFetchFailure = {
  NO_CAPTIONS: "no-captions",
  VIDEO_UNAVAILABLE: "video-unavailable",
  ACCESS_RESTRICTED: "access-restricted",
  SOURCE_BLOCKED: "source-blocked",
  RATE_LIMITED: "rate-limited",
  SOURCE_UNAVAILABLE: "source-unavailable",
  MALFORMED_RESPONSE: "malformed-response",
  SOURCE_UNSUPPORTED: "source-unsupported",
  // Not worth retrying until tomorrow: docs/architecture/server-side-transcripts.md, "Limits".
  BUDGET_EXHAUSTED: "budget-exhausted",
  // The extension can still fetch it: docs/architecture/server-side-transcripts.md, "Limits".
  DAILY_CAP: "daily-cap",
} as const;

export type TranscriptFetchFailure = (typeof TranscriptFetchFailure)[keyof typeof TranscriptFetchFailure];

const RETRYABLE: ReadonlySet<TranscriptFetchFailure> = new Set([
  TranscriptFetchFailure.RATE_LIMITED,
  TranscriptFetchFailure.SOURCE_UNAVAILABLE,
]);

export const isRetryableFailure = (failure: TranscriptFetchFailure): boolean => RETRYABLE.has(failure);

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

export const isWorthAnotherSource = (failure: TranscriptFetchFailure): boolean => WORTH_ANOTHER_SOURCE.has(failure);
