import { isRetryableFailure, type TranscriptFetchFailure } from "./TranscriptFetchFailure.js";

export interface TranscriptFetchErrorOptions {
  failure: TranscriptFetchFailure;
  cause?: unknown;
  sourceId?: string;
  retryAfterSeconds?: number;
}

// Derived, so a caller can't name a failure and then contradict it.
export class TranscriptFetchError extends Error {
  readonly failure: TranscriptFetchFailure;
  readonly retryable: boolean;
  readonly sourceId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, options: TranscriptFetchErrorOptions) {
    super(message, { cause: options.cause });
    this.failure = options.failure;
    this.retryable = isRetryableFailure(options.failure);
    this.sourceId = options.sourceId ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}
