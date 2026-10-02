import { MAX_CLIENT_ERROR_BATCH, MAX_CLIENT_WARNING_BATCH, type ClientWarning, type SentClientError } from "@overview/domain";
import type { SendOptions } from "../analytics/AnalyticsQueue.js";

export interface QueuedErrorBatch {
  errors: SentClientError[];
  warnings?: ClientWarning[];
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
  #heldWarnings: ClientWarning[] = [];
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
    if (this.#admit(this.#held.length >= MAX_CLIENT_ERROR_BATCH)) this.#held.push(error);
  }

  // Warnings share the errors' budget and their batch, so a loop that keeps falling back
  // can't send more than a loop that keeps throwing.
  recordWarning(warning: ClientWarning): void {
    if (this.#admit(this.#heldWarnings.length >= MAX_CLIENT_WARNING_BATCH)) this.#heldWarnings.push(warning);
  }

  #admit(full: boolean): boolean {
    const now = this.#now().getTime();
    if (now - this.#minuteStartedAt >= MINUTE_MS) {
      this.#minuteStartedAt = now;
      this.#inMinute = 0;
    }
    if (this.#inMinute >= this.#maxPerMinute || full) {
      this.#dropped += 1;
      return false;
    }
    this.#inMinute += 1;
    this.#timer ??= setTimeout(() => void this.flush(), this.#batchWindowMs);
    return true;
  }

  async flush({ keepalive }: SendOptions = { keepalive: false }): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#held.length === 0 && this.#heldWarnings.length === 0) return;
    const errors = this.#held;
    const warnings = this.#heldWarnings;
    const dropped = this.#dropped;
    this.#held = [];
    this.#heldWarnings = [];
    this.#dropped = 0;
    const lost = dropped + errors.length + warnings.length;
    if (!this.#canSend()) {
      this.#dropped += lost;
      return;
    }
    try {
      await this.#send(
        { errors, ...(warnings.length === 0 ? {} : { warnings }), ...(dropped === 0 ? {} : { dropped }) },
        { keepalive },
      );
    } catch {
      this.#dropped += lost;
    }
  }

  dispose(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#held = [];
    this.#heldWarnings = [];
  }
}
