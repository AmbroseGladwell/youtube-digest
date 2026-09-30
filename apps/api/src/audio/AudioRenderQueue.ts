import { NarrationVoice, narrationLanguage } from "@overview/domain";
import type { AudioRendersRepository } from "./AudioRendersRepository.js";
import type { AudioStore } from "./AudioStore.js";
import type { Narrator } from "./Narrator.js";

export const MAX_RENDER_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30_000, 120_000];
const STALE_RENDER_MS = 15 * 60 * 1000;

export interface RenderLog {
  info(entry: object, message: string): void;
  warn(entry: object, message: string): void;
}

export interface AudioRenderQueueOptions {
  renders: AudioRendersRepository;
  narrator: Narrator;
  store: AudioStore;
  clock: () => Date;
  concurrency: number;
  log: RenderLog;
  runWorkers: boolean;
}

// Up to `concurrency` workers, one per TTS machine the pool can start, each taking the next
// job until none is left (docs/features/tts-pre-rendered-speech.md, "The API side").
export class AudioRenderQueue {
  #options: AudioRenderQueueOptions;
  #active = 0;

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
    } catch (error) {
      this.#options.log.warn({ error: String(error) }, "audio worker stopped");
    }
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
      attempt: job.attempts,
      queueWaitSeconds: (claimedAt.getTime() - job.requestedAt.getTime()) / 1000,
    };
    try {
      const voice = NarrationVoice.parse(job.voice);
      const narration = await narrator.narrate({
        lines: job.lines,
        voice,
        language: narrationLanguage(voice),
        renderVersion: job.renderVersion,
      });
      await store.put(job.key, narration.audio);
      await renders.markReady(job.key, narration.lineStartsSeconds, narration.durationSeconds, clock());
      log.info(
        { ...entry, synthesisSeconds: narration.synthesisSeconds, audioSeconds: narration.durationSeconds },
        "audio rendered",
      );
    } catch (error) {
      const delay = RETRY_DELAYS_MS[Math.min(job.attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
      const now = clock();
      const status = await renders.markAttemptFailed(
        job.key,
        String(error),
        new Date(now.getTime() + delay),
        MAX_RENDER_ATTEMPTS,
        now,
      );
      log.warn({ ...entry, error: String(error), status }, "audio render failed");
      if (status === "queued" && this.#options.runWorkers) {
        setTimeout(() => this.kick(), delay).unref();
      }
    }
    return true;
  }
}
