import { SupadataError, type Transcript } from "@supadata/js";
import type { TranscriptSegment } from "@overview/types";
import type { TranscriptSourceClient } from "./TranscriptSourceClient.js";
import { TranscriptFetchError } from "./TranscriptFetchError.js";
import { mapTranscriptContent } from "./mapTranscriptContent.js";
import { pollTranscriptJob, type PollOptions } from "./pollTranscriptJob.js";
import { TRANSIENT_ERRORS, withSingleRetry } from "./withSingleRetry.js";

export interface FetchTranscriptOptions {
  lang?: string;
  allowGeneratedFallback: boolean;
  poll?: PollOptions;
}

export const DEFAULT_FETCH_OPTIONS: FetchTranscriptOptions = { allowGeneratedFallback: true };

export interface FetchedTranscriptContent {
  transcript: TranscriptSegment[];
  generated: boolean;
}

async function resolveTranscriptContent(
  client: TranscriptSourceClient,
  url: string,
  mode: "native" | "generate",
  lang: string | undefined,
  poll: PollOptions | undefined,
): Promise<Transcript> {
  const result = await client.transcript({ url, text: false, mode, ...(lang ? { lang } : {}) });
  if ("jobId" in result) {
    return poll ? pollTranscriptJob(client, result.jobId, poll) : pollTranscriptJob(client, result.jobId);
  }
  return result;
}

// The call that spends a Supadata credit. Everything a caller can do to avoid spending one
// has to happen before this is reached.
export async function fetchTranscriptContent(
  client: TranscriptSourceClient,
  url: string,
  options: FetchTranscriptOptions = DEFAULT_FETCH_OPTIONS,
): Promise<FetchedTranscriptContent> {
  try {
    const transcript = await withSingleRetry(() =>
      resolveTranscriptContent(client, url, "native", options.lang, options.poll),
    );
    return { transcript: mapTranscriptContent(transcript.content), generated: false };
  } catch (error) {
    const noNativeCaptions = error instanceof SupadataError && error.error === "transcript-unavailable";
    if (!noNativeCaptions || !options.allowGeneratedFallback) {
      throw wrapTranscriptError(error);
    }
    const transcript = await withSingleRetry(() =>
      resolveTranscriptContent(client, url, "generate", options.lang, options.poll),
    );
    return { transcript: mapTranscriptContent(transcript.content), generated: true };
  }
}

function wrapTranscriptError(error: unknown): TranscriptFetchError {
  if (error instanceof TranscriptFetchError) return error;
  if (error instanceof SupadataError) {
    return new TranscriptFetchError(error.message, {
      retryable: TRANSIENT_ERRORS.has(error.error),
      cause: error,
    });
  }
  return new TranscriptFetchError("transcript fetch failed", { retryable: true, cause: error });
}
