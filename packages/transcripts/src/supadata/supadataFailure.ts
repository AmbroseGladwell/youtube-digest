import { SupadataError } from "@supadata/js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";

const SUPADATA_FAILURES: Record<SupadataError["error"], TranscriptFetchFailure> = {
  "transcript-unavailable": TranscriptFetchFailure.NO_CAPTIONS,
  "not-found": TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  unauthorized: TranscriptFetchFailure.SOURCE_UNSUPPORTED,
  "upgrade-required": TranscriptFetchFailure.SOURCE_UNSUPPORTED,
  "limit-exceeded": TranscriptFetchFailure.RATE_LIMITED,
  "internal-error": TranscriptFetchFailure.SOURCE_UNAVAILABLE,
  "invalid-request": TranscriptFetchFailure.MALFORMED_RESPONSE,
};

export const SUPADATA_SOURCE_ID = "supadata";

export const supadataFailureFor = (
  code: SupadataError["error"] | undefined,
): TranscriptFetchFailure =>
  (code && SUPADATA_FAILURES[code]) ?? TranscriptFetchFailure.SOURCE_UNAVAILABLE;

// An adapter's contract is that every rejection is a TranscriptFetchError, so this is the
// one place a SupadataError is allowed to stop being one.
export function asTranscriptFetchError(error: unknown): TranscriptFetchError {
  if (error instanceof TranscriptFetchError) {
    return error;
  }
  if (error instanceof SupadataError) {
    return new TranscriptFetchError(error.message, {
      failure: SUPADATA_FAILURES[error.error] ?? TranscriptFetchFailure.SOURCE_UNAVAILABLE,
      cause: error,
      sourceId: SUPADATA_SOURCE_ID,
    });
  }
  return new TranscriptFetchError("transcript fetch failed", {
    failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
    cause: error,
    sourceId: SUPADATA_SOURCE_ID,
  });
}
