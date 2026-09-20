import { isRetryableFailure, type TranscriptFetchFailure } from "./TranscriptFetchFailure.js";

// retryable is derived rather than passed, so a caller cannot name a failure and then
// contradict it (docs/features/transcript-retrieval.md).
export class TranscriptFetchError extends Error {
  readonly failure: TranscriptFetchFailure;
  readonly retryable: boolean;
  readonly sourceId: string | null;

  constructor(
    message: string,
    options: { failure: TranscriptFetchFailure; cause?: unknown; sourceId?: string },
  ) {
    super(message, { cause: options.cause });
    this.failure = options.failure;
    this.retryable = isRetryableFailure(options.failure);
    this.sourceId = options.sourceId ?? null;
  }
}
