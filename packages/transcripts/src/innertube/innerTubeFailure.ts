import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";

export const INNERTUBE_SOURCE_ID = "innertube";

const PLAYABILITY_FAILURES: Record<string, TranscriptFetchFailure> = {
  ERROR: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  LIVE_STREAM_OFFLINE: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  LOGIN_REQUIRED: TranscriptFetchFailure.ACCESS_RESTRICTED,
  UNPLAYABLE: TranscriptFetchFailure.ACCESS_RESTRICTED,
  AGE_CHECK_REQUIRED: TranscriptFetchFailure.ACCESS_RESTRICTED,
  CONTENT_CHECK_REQUIRED: TranscriptFetchFailure.ACCESS_RESTRICTED,
};

// Every rejection out of this source is a TranscriptFetchError, so the ladder above never
// has to guess what it caught.
export function asInnerTubeError(error: unknown): TranscriptFetchError {
  return error instanceof TranscriptFetchError
    ? error
    : innerTubeError("the request failed", TranscriptFetchFailure.SOURCE_UNAVAILABLE, error);
}

export function innerTubeError(
  message: string,
  failure: TranscriptFetchFailure,
  cause?: unknown,
): TranscriptFetchError {
  return new TranscriptFetchError(message, {
    failure,
    ...(cause === undefined ? {} : { cause }),
    sourceId: INNERTUBE_SOURCE_ID,
  });
}

// A status this does not recognise is treated as the client being turned away rather than
// as a fact about the video, so the next client is still worth trying.
export function playabilityFailure(status: string | undefined): TranscriptFetchFailure | null {
  if (status === "OK") return null;
  if (status === undefined) return TranscriptFetchFailure.MALFORMED_RESPONSE;
  return PLAYABILITY_FAILURES[status] ?? TranscriptFetchFailure.SOURCE_BLOCKED;
}

export function httpFailure(status: number): TranscriptFetchFailure {
  if (status === 429) return TranscriptFetchFailure.RATE_LIMITED;
  if (status >= 500) return TranscriptFetchFailure.SOURCE_UNAVAILABLE;
  // 400 and 403 here are what a stale client version looks like, not a fact about the
  // video (docs/features/transcript-retrieval.md).
  return TranscriptFetchFailure.MALFORMED_RESPONSE;
}
