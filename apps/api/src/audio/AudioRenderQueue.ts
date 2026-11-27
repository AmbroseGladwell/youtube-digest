import { randomUUID } from "node:crypto";
import { apiLogLines, narrationLanguage, NarrationVoice, redactErrorMessage } from "@overview/domain";
import type { AudioRendersRepository } from "./AudioRendersRepository.js";
import type { AudioStore } from "./AudioStore.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { MachineTime, MODAL_CONTAINER } from "../speech/MachineTime.js";
import { speechDetail, speechDollars } from "../speech/speechCost.js";
import type { NarrationSegment, Narrator, SpeechHost } from "./Narrator.js";
import type { AccountId } from "../auth/AccountId.js";

export const MAX_RENDER_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30_000, 120_000];
const STALE_RENDER_MS = 15 * 60 * 1000;
// Long enough for any first play that began on the segments to reach the end of them.
export const SEGMENTS_KEPT_MS = 60 * 60 * 1000;
const SEGMENT_SWEEP_BATCH = 20;

export interface RenderLog {
  info(line: object): void;
  warn(line: object): void;
  error(line: object): void;
}

export interface AudioRenderQueueOptions {
  renders: AudioRendersRepository;
  narrator: Narrator;
  store: AudioStore;
  clock: () => Date;
  concurrency: number;
  log: RenderLog;
  runWorkers: boolean;
  costs?: AccountCostsRepository | null;
  modalDollarsPerHour?: number | null;
}

export class AudioRenderQueue {
  #options: AudioRenderQueueOptions;
  #active = 0;
  #modalTime = new MachineTime(MODAL_CONTAINER);

  constructor(options: AudioRenderQueueOptions) {
    this.#options = options;
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
    while (await this.#renderNext()) {}
  }

  async #work(): Promise<void> {
    try {
      while (await this.#renderNext()) {}
      await this.sweepSegments();
    } catch (error) {
      this.#options.log.error(apiLogLines.audio.workerStopped({ error: redactErrorMessage(String(error)) }));
    }
  }

  async sweepSegments(): Promise<void> {
    const { renders, store, clock, log } = this.#options;
    const keys = await renders.segmentsKeptSince(new Date(clock().getTime() - SEGMENTS_KEPT_MS), SEGMENT_SWEEP_BATCH);
    for (const key of keys) {
      await store.deleteSegments(key);
      await renders.forgetSegments(key);
    }
    if (keys.length > 0) {
      log.info(apiLogLines.audio.segmentsSwept({ renders: keys.length }));
    }
  }

  // Renders on Fly are its fixed bill (docs/architecture/spend.md); a render on Modal costs the account that asked.
  async #recordCost(requestedBy: AccountId | null, host: SpeechHost, startedAt: Date, readyAt: Date): Promise<void> {
    const { costs, modalDollarsPerHour, log } = this.#options;
    if (host !== "modal" || costs === undefined || costs === null || modalDollarsPerHour === undefined || modalDollarsPerHour === null) {
      return;
    }
    const seconds = this.#modalTime.charge(startedAt, readyAt).seconds;
    const payer = requestedBy === null ? "signed-out" : { accountId: requestedBy };
    await costs.recordOrLog(
      readyAt,
      payer,
      { area: "speech", detail: speechDetail("narration", host), quantity: seconds, dollars: speechDollars(seconds, modalDollarsPerHour) },
      log,
    );
  }

  async #renderNext(): Promise<boolean> {
    const { renders, narrator, store, clock, log } = this.#options;
    const claimedAt = clock();
    const job = await renders.claimNext(claimedAt, new Date(claimedAt.getTime() - STALE_RENDER_MS), MAX_RENDER_ATTEMPTS);
    if (job === null) {
      return false;
    }
    const entry = {
      key: job.key,
      voice: job.voice,
      priority: job.priority,
      lines: job.lines.length,
      attempt: job.attempts,
      ttsRequestId: randomUUID(),
      queueWaitSeconds: (claimedAt.getTime() - job.requestedAt.getTime()) / 1000,
    };
    const lineStarts: number[] = [];
    const segmentSeconds: number[] = [];
    const firstAudio: { at: Date | null } = { at: null };
    const startedAt = clock();
    const keepSegments = async (segments: NarrationSegment[]) => {
      for (const segment of segments) {
        await store.putSegment(job.key, segment.index, segment.audio);
        segmentSeconds.push(segment.durationSeconds);
      }
    };
    try {
      const voice = NarrationVoice.parse(job.voice);
      const narration = await narrator.narrate(
        { lines: job.lines, voice, language: narrationLanguage(voice), renderVersion: job.renderVersion },
        entry.ttsRequestId,
        async (line) => {
          await keepSegments(line.segments);
          lineStarts.push(line.startSeconds);
          await renders.recordLines(job.key, job.attempts, lineStarts, segmentSeconds);
          if (firstAudio.at === null && segmentSeconds.length > 0) {
            firstAudio.at = clock();
          }
        },
      );
      await keepSegments(narration.trailingSegments);
      await store.put(job.key, narration.audio);
      const readyAt = clock();
      await renders.markReady(job.key, narration.lineStartsSeconds, narration.durationSeconds, segmentSeconds, readyAt);
      await this.#recordCost(job.requestedBy, narration.host, startedAt, readyAt);
      log.info(
        apiLogLines.audio.rendered({
          ...entry,
          synthesisSeconds: narration.synthesisSeconds,
          audioSeconds: narration.durationSeconds,
          bytes: narration.audio.byteLength,
          segments: segmentSeconds.length,
          host: narration.host,
          fellBack: narration.fellBack,
          requestToFirstAudioSeconds: firstAudio.at === null ? null : (firstAudio.at.getTime() - job.requestedAt.getTime()) / 1000,
          requestToReadySeconds: (readyAt.getTime() - job.requestedAt.getTime()) / 1000,
        }),
      );
    } catch (error) {
      const delay = RETRY_DELAYS_MS[Math.min(job.attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
      const now = clock();
      const status = await renders.markAttemptFailed(job.key, String(error), new Date(now.getTime() + delay), MAX_RENDER_ATTEMPTS, now);
      const failed = { ...entry, error: redactErrorMessage(String(error)), status };
      if (status === "failed") {
        log.error(apiLogLines.audio.renderGaveUp(failed));
      } else {
        log.warn(apiLogLines.audio.renderFailed(failed));
      }
      if (status === "queued" && this.#options.runWorkers) {
        setTimeout(() => this.kick(), delay).unref();
      }
    }
    return true;
  }
}
