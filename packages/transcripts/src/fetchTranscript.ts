import { SupadataError, type Transcript } from "@supadata/js";
import type { TranscriptSourceClient } from "./TranscriptSourceClient.js";
import type { FetchedTranscript } from "./FetchedTranscript.js";
import { TranscriptFetchError } from "./TranscriptFetchError.js";
import { mapMetadataToVideoSource } from "./mapMetadataToVideoSource.js";
import { mapTranscriptContent } from "./mapTranscriptContent.js";
import { pollTranscriptJob, type PollOptions } from "./pollTranscriptJob.js";

export interface FetchTranscriptOptions {
  lang?: string;
  allowGeneratedFallback: boolean;
  poll?: PollOptions;
}

export const DEFAULT_FETCH_OPTIONS: FetchTranscriptOptions = { allowGeneratedFallback: true };

const TRANSIENT_ERRORS = new Set(["internal-error", "limit-exceeded"]);

function isRetryable(error: unknown): boolean {
  if (error instanceof SupadataError) return TRANSIENT_ERRORS.has(error.error);
  if (error instanceof TranscriptFetchError) return error.retryable;
  return true; // an unrecognised (likely network) failure — worth one retry.
}

async function withSingleRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    return await action();
  }
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

export async function fetchTranscript(
  client: TranscriptSourceClient,
  url: string,
  options: FetchTranscriptOptions = DEFAULT_FETCH_OPTIONS,
): Promise<FetchedTranscript> {
  const metadata = await withSingleRetry(() => client.metadata({ url }));
  const video = mapMetadataToVideoSource(metadata, url);

  let generated = false;
  let transcript: Transcript;
  try {
    transcript = await withSingleRetry(() =>
      resolveTranscriptContent(client, url, "native", options.lang, options.poll),
    );
  } catch (error) {
    const noNativeCaptions = error instanceof SupadataError && error.error === "transcript-unavailable";
    if (!noNativeCaptions || !options.allowGeneratedFallback) {
      throw wrapTranscriptError(error);
    }
    generated = true;
    transcript = await withSingleRetry(() =>
      resolveTranscriptContent(client, url, "generate", options.lang, options.poll),
    );
  }

  return { video, transcript: mapTranscriptContent(transcript.content), generated };
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
