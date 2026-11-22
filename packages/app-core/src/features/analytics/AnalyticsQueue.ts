import { MAX_ANALYTICS_BATCH_EVENTS, type AnalyticsEventName, type SentAnalyticsEvent } from "@overview/domain";

export interface SendOptions {
  keepalive: boolean;
}

export interface QueuedBatch {
  events: SentAnalyticsEvent[];
  // Logged by the server rather than counted: docs/architecture/analytics.md, "Actions, not logs".
  dropped?: number;
}

// What "hold" and "discard" mean: docs/features/analytics-consent.md, "Before an answer".
export type AnalyticsSendMode = "send" | "hold" | "discard";

export interface AnalyticsQueueOptions {
  mode: () => AnalyticsSendMode;
  send: (batch: QueuedBatch, options: SendOptions) => Promise<void>;
  now?: () => Date;
  batchWindowMs?: number;
  maxPerMinute?: number;
}

const MINUTE_MS = 60 * 1000;
const HELD_LIMIT = MAX_ANALYTICS_BATCH_EVENTS;

// Never retried, never on the device: docs/architecture/analytics.md, "The client".
export class AnalyticsQueue {
  readonly #mode: () => AnalyticsSendMode;
  readonly #send: AnalyticsQueueOptions["send"];
  readonly #now: () => Date;
  readonly #batchWindowMs: number;
  readonly #maxPerMinute: number;
  #held: SentAnalyticsEvent[] = [];
  #dropped = 0;
  #minuteStartedAt = Number.NEGATIVE_INFINITY;
  #inMinute = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({ mode, send, now = () => new Date(), batchWindowMs = 2_000, maxPerMinute = 60 }: AnalyticsQueueOptions) {
    this.#mode = mode;
    this.#send = send;
    this.#now = now;
    this.#batchWindowMs = batchWindowMs;
    this.#maxPerMinute = maxPerMinute;
  }

  record(name: AnalyticsEventName, props: Record<string, string | number | boolean>): void {
    const mode = this.#mode();
    if (mode === "discard") {
      return;
    }
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
    if (mode === "send") {
      this.#timer ??= setTimeout(() => void this.flush(), this.#batchWindowMs);
    }
  }

  async flush({ keepalive }: SendOptions = { keepalive: false }): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#held.length === 0) {
      return;
    }
    const mode = this.#mode();
    if (mode === "hold") {
      return;
    }
    if (mode === "discard") {
      this.#held = [];
      this.#dropped = 0;
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
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }
    this.#timer = null;
    this.#held = [];
  }
}
