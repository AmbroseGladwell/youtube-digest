import type { Transcript } from "@supadata/js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import { isRetryable } from "../withSingleRetry.js";
import type { SupadataClient } from "./SupadataClient.js";
import { asTranscriptFetchError, supadataFailureFor } from "./supadataFailure.js";

export interface PollOptions {
  intervalMs: number;
  timeoutMs: number;
}

export const DEFAULT_POLL_OPTIONS: PollOptions = { intervalMs: 1000, timeoutMs: 5 * 60 * 1000 };

export async function pollTranscriptJob(
  client: SupadataClient,
  jobId: string,
  options: PollOptions = DEFAULT_POLL_OPTIONS,
): Promise<Transcript> {
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    // A status read that failed told us nothing about the job, which is still running.
    // Status costs no credit, so another tick is free (docs/features/transcript-retrieval.md).
    const job = await client.transcript.getJobStatus(jobId).catch((error: unknown) => {
      if (!isRetryable(asTranscriptFetchError(error))) throw asTranscriptFetchError(error);
      return null;
    });

    if (job === null) {
      await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
      continue;
    }

    if (job.status === "completed") {
      if (!job.result) {
        throw new TranscriptFetchError("transcript job completed with no result", {
          failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
        });
      }
      return job.result;
    }

    if (job.status === "failed") {
      throw new TranscriptFetchError(
        `transcript job failed: ${job.error?.message ?? "no error detail given"}`,
        { failure: supadataFailureFor(job.error?.error) },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new TranscriptFetchError(`transcript job ${jobId} timed out after ${options.timeoutMs}ms`, {
    failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
  });
}
