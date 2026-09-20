import { TranscriptFetchError } from "./TranscriptFetchError.js";

export function isRetryable(error: unknown): boolean {
  if (error instanceof TranscriptFetchError) return error.retryable;
  return true; // an unrecognised (likely network) failure — worth one retry.
}

export async function withSingleRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    return await action();
  }
}
