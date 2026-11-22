// Why every call shares one budget: docs/features/podcast-links.md, "The directories".
export interface CallBudgetOptions {
  perMinute: number;
  mostWaitMs: number;
  keepMs: (url: string) => number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const WINDOW_MS = 60_000;
const MOST_KEPT = 500;

export class BudgetSpentError extends Error {
  constructor() {
    super("The directory is busy; try again in a moment");
  }
}

export const callBudget = <Rest extends unknown[]>(
  fetchJson: (url: string, ...rest: Rest) => Promise<unknown>,
  options: CallBudgetOptions,
): ((url: string, ...rest: Rest) => Promise<unknown>) => {
  const calls: number[] = [];
  const kept = new Map<string, { until: number; value: unknown }>();

  const take = async (): Promise<void> => {
    const deadline = options.now() + options.mostWaitMs;
    for (;;) {
      const now = options.now();
      while (calls.length > 0 && calls[0]! <= now - WINDOW_MS) {
        calls.shift();
      }
      if (calls.length < options.perMinute) {
        calls.push(now);
        return;
      }
      const freeAt = calls[0]! + WINDOW_MS;
      if (freeAt > deadline) {
        throw new BudgetSpentError();
      }
      await options.sleep(freeAt - now);
    }
  };

  return async (url, ...rest) => {
    const hit = kept.get(url);
    if (hit !== undefined && hit.until > options.now()) {
      return hit.value;
    }
    await take();
    const value = await fetchJson(url, ...rest);
    if (kept.size >= MOST_KEPT) {
      kept.delete(kept.keys().next().value!);
    }
    kept.set(url, { until: options.now() + options.keepMs(url), value });
    return value;
  };
};

const HOUR_MS = 60 * 60_000;

// Under Apple's "approximately 20 calls per minute", since a deploy can briefly run two machines.
export const APPLE_BUDGET: CallBudgetOptions = {
  perMinute: 15,
  mostWaitMs: 15_000,
  keepMs: (url) => (url.includes("/lookup?") ? HOUR_MS : 24 * HOUR_MS),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Why these numbers: docs/features/podcast-links.md, "The directories".
export const PODCAST_INDEX_BUDGET: CallBudgetOptions = {
  perMinute: 20,
  mostWaitMs: 2_000,
  keepMs: (url) => (url.includes("/search/") ? 24 * HOUR_MS : HOUR_MS),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
