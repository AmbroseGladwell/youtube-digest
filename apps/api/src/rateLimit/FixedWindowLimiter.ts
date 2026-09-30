import type { RateLimit } from "./RateLimit.js";

export type LimiterVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Window {
  startedAt: number;
  count: number;
}

export class FixedWindowLimiter {
  readonly rateLimit: RateLimit;
  readonly #windows = new Map<string, Window>();
  #nextSweepAt = 0;

  constructor(rateLimit: RateLimit) {
    this.rateLimit = rateLimit;
  }

  get trackedKeys(): number {
    return this.#windows.size;
  }

  take(key: string, now: Date): LimiterVerdict {
    const at = now.getTime();
    this.#sweep(at);
    const current = this.#windows.get(key);
    const window = current === undefined || this.#hasEnded(current, at) ? { startedAt: at, count: 0 } : current;
    if (window.count >= this.rateLimit.limit) {
      const endsAt = window.startedAt + this.rateLimit.windowMs;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((endsAt - at) / 1000)) };
    }
    window.count += 1;
    this.#windows.set(key, window);
    return { allowed: true };
  }

  #hasEnded(window: Window, at: number): boolean {
    return at >= window.startedAt + this.rateLimit.windowMs;
  }

  #sweep(at: number): void {
    if (at < this.#nextSweepAt) {
      return;
    }
    for (const [key, window] of this.#windows) {
      if (this.#hasEnded(window, at)) {
        this.#windows.delete(key);
      }
    }
    this.#nextSweepAt = at + this.rateLimit.windowMs;
  }
}
