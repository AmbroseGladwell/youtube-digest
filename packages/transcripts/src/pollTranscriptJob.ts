import type { Transcript } from "@supadata/js";
import type { TranscriptSourceClient } from "./TranscriptSourceClient.js";
import { TranscriptFetchError } from "./TranscriptFetchError.js";

export interface PollOptions {
  intervalMs: number;
  timeoutMs: number;
}

export const DEFAULT_POLL_OPTIONS: PollOptions = { intervalMs: 1000, timeoutMs: 5 * 60 * 1000 };

export async function pollTranscriptJob(
  client: TranscriptSourceClient,
  jobId: string,
  options: PollOptions = DEFAULT_POLL_OPTIONS,
): Promise<Transcript> {
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    const job = await client.transcript.getJobStatus(jobId);

    if (job.status === "completed") {
      if (!job.result) {
        throw new TranscriptFetchError("transcript job completed with no result", { retryable: true });
      }
      return job.result;
    }

    if (job.status === "failed") {
      throw new TranscriptFetchError(
        `transcript job failed: ${job.error?.message ?? "no error detail given"}`,
        { retryable: job.error?.error === "internal-error" },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new TranscriptFetchError(`transcript job ${jobId} timed out after ${options.timeoutMs}ms`, {
    retryable: true,
  });
}
