import { MAX_ANALYTICS_BATCH_EVENTS, type AnalyticsEventName, type SentAnalyticsEvent } from "@overview/domain";

export interface SendOptions {
  keepalive: boolean;
}

export interface QueuedBatch {
  events: SentAnalyticsEvent[];
  // How many were lost since the last batch got through: the queue's own bookkeeping, which
  // the server logs rather than counts (docs/architecture/analytics.md, "Actions, not logs").
  dropped?: number;
}

export interface AnalyticsQueueOptions {
  // Whether this reader's usage may be sent at all. When it may not, events are not held,
  // sent or counted as dropped: they were never collected.
  canSend: () => boolean;
  send: (batch: QueuedBatch, options: SendOptions) => Promise<void>;
  now?: () => Date;
  batchWindowMs?: number;
  maxPerMinute?: number;
}

const MINUTE_MS = 60 * 1000;
const HELD_LIMIT = MAX_ANALYTICS_BATCH_EVENTS;

// Events held in memory for a moment and sent together. Nothing is written to the device,
// nothing is retried, and nothing here can fail or slow what the reader did; what is lost is
// counted and said with the next batch that gets through (docs/architecture/analytics.md).
export class AnalyticsQueue {
  readonly #canSend: () => boolean;
  readonly #send: AnalyticsQueueOptions["send"];
  readonly #now: () => Date;
  readonly #batchWindowMs: number;
  readonly #maxPerMinute: number;
  #held: SentAnalyticsEvent[] = [];
  #dropped = 0;
  #minuteStartedAt = Number.NEGATIVE_INFINITY;
  #inMinute = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({ canSend, send, now = () => new Date(), batchWindowMs = 2_000, maxPerMinute = 60 }: AnalyticsQueueOptions) {
    this.#canSend = canSend;
    this.#send = send;
    this.#now = now;
    this.#batchWindowMs = batchWindowMs;
    this.#maxPerMinute = maxPerMinute;
  }

  record(name: AnalyticsEventName, props: Record<string, string | number | boolean>): void {
    if (!this.#canSend()) return;
    const now = this.#now();
    if (now.getTime() - this.#minuteStartedAt >= MINUTE_MS) {
      this.#minuteStartedAt = now.getTime();
      this.#inMinute = 0;
    }
    if (this.#inMinute >= this.#maxPerMinute || this.#held.length >= HELD_LIMIT) {
      this.#dropped += 1;
      return;
    }
    this.#inMinute += 1;
    this.#held.push({ name, props, at: now.toISOString() });
    this.#timer ??= setTimeout(() => void this.flush(), this.#batchWindowMs);
  }

  async flush({ keepalive }: SendOptions = { keepalive: false }): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#held.length === 0) return;
    if (!this.#canSend()) {
      this.#held = [];
      return;
    }
    const events = this.#held;
    const dropped = this.#dropped;
    this.#held = [];
    this.#dropped = 0;
    try {
      await this.#send(dropped === 0 ? { events } : { events, dropped }, { keepalive });
    } catch {
      this.#dropped += dropped + events.length;
    }
  }

  dispose(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#held = [];
  }
}
