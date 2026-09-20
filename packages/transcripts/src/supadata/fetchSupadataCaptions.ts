import type { Transcript } from "@supadata/js";
import type { FetchedCaptions } from "../FetchedCaptions.js";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import { withSingleRetry } from "../withSingleRetry.js";
import { mapTranscriptContent } from "./mapTranscriptContent.js";
import { pollTranscriptJob, type PollOptions } from "./pollTranscriptJob.js";
import type { SupadataClient } from "./SupadataClient.js";
import { asTranscriptFetchError } from "./supadataFailure.js";

export interface FetchCaptionsOptions {
  lang?: string;
  allowGeneratedFallback: boolean;
  poll?: PollOptions;
}

export const DEFAULT_FETCH_OPTIONS: FetchCaptionsOptions = { allowGeneratedFallback: true };

// Only the submit is retried. Retrying the whole thing would abandon a running job and
// start a second one, spending a second credit (docs/features/transcript-retrieval.md).
async function resolveMode(
  client: SupadataClient,
  url: string,
  mode: "native" | "generate",
  options: FetchCaptionsOptions,
): Promise<Transcript> {
  const submitted = await withSingleRetry(() =>
    client
      .transcript({ url, text: false, mode, ...(options.lang ? { lang: options.lang } : {}) })
      .catch((error: unknown) => {
        throw asTranscriptFetchError(error);
      }),
  );
  if ("jobId" in submitted) {
    return options.poll
      ? pollTranscriptJob(client, submitted.jobId, options.poll)
      : pollTranscriptJob(client, submitted.jobId);
  }
  return submitted;
}

async function nativeThenGenerated(
  client: SupadataClient,
  url: string,
  options: FetchCaptionsOptions,
): Promise<FetchedCaptions> {
  try {
    const native = await resolveMode(client, url, "native", options);
    return { transcript: mapTranscriptContent(native.content), generated: false };
  } catch (error) {
    const failed = asTranscriptFetchError(error);
    if (failed.failure !== TranscriptFetchFailure.NO_CAPTIONS || !options.allowGeneratedFallback) {
      throw failed;
    }
    const generated = await resolveMode(client, url, "generate", options);
    return { transcript: mapTranscriptContent(generated.content), generated: true };
  }
}

// The call that spends a Supadata credit. Everything a caller can do to avoid spending one
// has to happen before this is reached.
export async function fetchSupadataCaptions(
  client: SupadataClient,
  url: string,
  options: FetchCaptionsOptions = DEFAULT_FETCH_OPTIONS,
): Promise<FetchedCaptions> {
  try {
    return await nativeThenGenerated(client, url, options);
  } catch (error) {
    throw asTranscriptFetchError(error);
  }
}
