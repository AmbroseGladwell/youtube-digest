import { MAX_CLIENT_ERROR_BATCH, type SentClientError } from "@overview/domain";
import type { SendOptions } from "../analytics/AnalyticsQueue.js";

export interface QueuedErrorBatch {
  errors: SentClientError[];
  dropped?: number;
}

export interface ErrorQueueOptions {
  // False when there is no server to send to; errors are then dropped and counted.
  canSend: () => boolean;
  send: (batch: QueuedErrorBatch, options: SendOptions) => Promise<void>;
  now?: () => Date;
  batchWindowMs?: number;
  maxPerMinute?: number;
}

const MINUTE_MS = 60 * 1000;

// Errors held for a moment and sent together, apart from events and ahead of them. As with
// events, nothing is written to the device or retried, and what is lost is counted on the
// next batch that gets through (docs/architecture/errors-and-logs.md, "The client").
export class ErrorQueue {
  readonly #canSend: () => boolean;
  readonly #send: ErrorQueueOptions["send"];
  readonly #now: () => Date;
  readonly #batchWindowMs: number;
  readonly #maxPerMinute: number;
  #held: SentClientError[] = [];
  #dropped = 0;
  #minuteStartedAt = Number.NEGATIVE_INFINITY;
  #inMinute = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({ canSend, send, now = () => new Date(), batchWindowMs = 1_000, maxPerMinute = 10 }: ErrorQueueOptions) {
    this.#canSend = canSend;
    this.#send = send;
    this.#now = now;
    this.#batchWindowMs = batchWindowMs;
    this.#maxPerMinute = maxPerMinute;
  }

  record(error: SentClientError): void {
    const now = this.#now().getTime();
    if (now - this.#minuteStartedAt >= MINUTE_MS) {
      this.#minuteStartedAt = now;
      this.#inMinute = 0;
    }
    if (this.#inMinute >= this.#maxPerMinute || this.#held.length >= MAX_CLIENT_ERROR_BATCH) {
      this.#dropped += 1;
      return;
    }
    this.#inMinute += 1;
    this.#held.push(error);
    this.#timer ??= setTimeout(() => void this.flush(), this.#batchWindowMs);
  }

  async flush({ keepalive }: SendOptions = { keepalive: false }): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#held.length === 0) return;
    const errors = this.#held;
    const dropped = this.#dropped;
    this.#held = [];
    this.#dropped = 0;
    if (!this.#canSend()) {
      this.#dropped += dropped + errors.length;
      return;
    }
    try {
      await this.#send(dropped === 0 ? { errors } : { errors, dropped }, { keepalive });
    } catch {
      this.#dropped += dropped + errors.length;
    }
  }

  dispose(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#held = [];
  }
}
