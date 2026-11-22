import { apiLogLines, redactErrorMessage, type StoredTranscript, type TranscriptionFailure, VideoId } from "@overview/domain";
import { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository, CostPayer } from "../costs/AccountCostsRepository.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { PodcastTranscriptionJob, PodcastTranscriptionsRepository } from "./PodcastTranscriptionsRepository.js";
import type { TranscribedAudio, Transcriber } from "./Transcriber.js";

// Why these limits: docs/features/speech-to-text.md, "The choice".
export const START_WAIT_MS = 2 * 60 * 1000;
export const RUN_LIMIT_MS = 15 * 60 * 1000;
const POLL_MS = 2000;
const LEASE_MS = 60 * 1000;
const HOST_ERRORS_TOLERATED = 5;
const KEEP_FINISHED_MS = 24 * 60 * 60 * 1000;

// Modal's list prices, 15 Nov 2026; an unlisted card costs the dearest, so a cost is never under-recorded.
export const GPU_DOLLARS_PER_HOUR: Record<string, number> = {
  "Tesla T4": 0.59,
  "NVIDIA L4": 0.8,
  "NVIDIA A10": 1.1,
  "NVIDIA L40S": 1.95,
};
const DEAREST_GPU = Math.max(...Object.values(GPU_DOLLARS_PER_HOUR));

const HOST_FAILURES: Record<string, TranscriptionFailure> = {
  audio_too_long: "too-long",
  audio_too_large: "too-long",
  audio_unreachable: "audio-unreachable",
  audio_unreadable: "audio-unreadable",
  no_speech: "no-speech",
};

export interface TranscriptionLog {
  info(line: object): void;
  warn(line: object): void;
  error(line: object): void;
}

export interface TranscriptionQueueOptions {
  jobs: PodcastTranscriptionsRepository;
  transcriber: Transcriber;
  costs: AccountCostsRepository;
  clock: () => Date;
  sleep?: (ms: number) => Promise<void>;
  concurrency: number;
  log: TranscriptionLog;
  runWorkers: boolean;
}

const payerOf = (caller: string): CostPayer => {
  const account = AccountId.safeParse(caller.replace(/^account:/, ""));
  return caller.startsWith("account:") && account.success ? { accountId: account.data } : "signed-out";
};

const seconds = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 100) / 10;

export class TranscriptionQueue {
  #options: TranscriptionQueueOptions;
  #sleep: (ms: number) => Promise<void>;
  #active = 0;

  constructor(options: TranscriptionQueueOptions) {
    this.#options = options;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms).unref()));
  }

  kick(): void {
    if (!this.#options.runWorkers) {
      return;
    }
    while (this.#active < this.#options.concurrency) {
      this.#active += 1;
      void this.#work().finally(() => {
        this.#active -= 1;
      });
    }
  }

  async drain(): Promise<void> {
    while (await this.#next()) {}
  }

  async #work(): Promise<void> {
    try {
      while (await this.#next()) {}
    } catch (error) {
      this.#options.log.error(apiLogLines.transcription.workerStopped({ error: redactErrorMessage(String(error)) }));
    }
  }

  #lease(): Date {
    return new Date(this.#options.clock().getTime() + LEASE_MS);
  }

  async #next(): Promise<boolean> {
    const { jobs, clock } = this.#options;
    const now = clock();
    const job = await jobs.claimNext(now, this.#lease(), new Date(now.getTime() - KEEP_FINISHED_MS));
    if (job === null) {
      return false;
    }
    await this.#run(job);
    return true;
  }

  async #run(job: PodcastTranscriptionJob): Promise<void> {
    const { jobs, transcriber, clock } = this.#options;
    let callId = job.hostCallId;
    if (callId === null) {
      try {
        callId = await transcriber.submit(job.audioUrl, job.maxSeconds);
      } catch (error) {
        await this.#fail(job, "failed", redactErrorMessage(String(error)));
        return;
      }
      await jobs.markSubmitted(job.id, callId, this.#lease());
    }
    let startedAt = job.startedAt;
    let hostErrors = 0;
    for (;;) {
      await this.#sleep(POLL_MS);
      const state = await transcriber.status(callId).then(
        (answer) => answer,
        () => null,
      );
      const now = clock();
      if (state === null) {
        hostErrors += 1;
        if (hostErrors > HOST_ERRORS_TOLERATED) {
          return this.#cancelAndFail(job, callId, "failed", "host_unanswering");
        }
        await jobs.renew(job.id, this.#lease());
        continue;
      }
      hostErrors = 0;
      if (state.state === "failed") {
        return this.#fail(job, HOST_FAILURES[state.error] ?? "failed", state.detail ?? state.error);
      }
      if (startedAt === null && state.state !== "waiting") {
        startedAt = now;
        await jobs.markStarted(job.id, now, this.#lease());
        this.#options.log.info(apiLogLines.transcription.started({ waitedSeconds: seconds(job.requestedAt, now) }));
      }
      if (state.state === "done") {
        return this.#finish(job, state.result);
      }
      if (startedAt === null && now.getTime() - job.requestedAt.getTime() > START_WAIT_MS) {
        return this.#cancelAndFail(job, callId, "no-transcriber", "no_card_in_time");
      }
      if (startedAt !== null && now.getTime() - startedAt.getTime() > RUN_LIMIT_MS) {
        return this.#cancelAndFail(job, callId, "failed", "ran_too_long");
      }
      await jobs.renew(job.id, this.#lease());
    }
  }

  async #finish(job: PodcastTranscriptionJob, result: TranscribedAudio): Promise<void> {
    const { jobs, costs, clock, log } = this.#options;
    const now = clock();
    const key = VideoId.parse(job.sourceKey);
    const transcript: StoredTranscript = { videoId: key, segments: result.segments, generated: true, fetchedAt: now.toISOString() };
    const fault = transcriptFault(transcript, key);
    if (fault !== null) {
      return this.#fail(job, "failed", fault);
    }
    await jobs.markReady(job, transcript, result.audioSeconds, now);
    const dollars = (result.workerSeconds / 3600) * (GPU_DOLLARS_PER_HOUR[result.gpu] ?? DEAREST_GPU);
    await costs.recordOrLog(
      now,
      payerOf(job.caller),
      { area: "transcripts", detail: "speech-to-text", quantity: Math.ceil(result.audioSeconds), dollars },
      log,
    );
    log.info(
      apiLogLines.transcription.finished({
        audioSeconds: result.audioSeconds,
        workerSeconds: result.workerSeconds,
        gpu: result.gpu,
        cold: result.cold,
        modelLoadSeconds: result.modelLoadSeconds,
        language: result.language,
        segments: result.segments.length,
        dollars,
        requestToReadySeconds: seconds(job.requestedAt, now),
      }),
    );
  }

  async #cancelAndFail(job: PodcastTranscriptionJob, callId: string, reason: TranscriptionFailure, detail: string): Promise<void> {
    await this.#options.transcriber.cancel(callId).catch(() => undefined);
    await this.#fail(job, reason, detail);
  }

  async #fail(job: PodcastTranscriptionJob, reason: TranscriptionFailure, detail: string): Promise<void> {
    const { jobs, clock, log } = this.#options;
    const now = clock();
    await jobs.markFailed(job, reason, now);
    log.warn(apiLogLines.transcription.failed({ reason, detail, afterSeconds: seconds(job.requestedAt, now) }));
  }
}
