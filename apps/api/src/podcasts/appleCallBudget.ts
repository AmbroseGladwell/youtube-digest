// Apple's Search API is "limited to approximately 20 calls per minute", and it sees our server's
// address, not each reader's, so every Apple call from this process shares one budget: at most
// `perMinute` in any 60 seconds, a call over it waiting its turn up to `mostWaitMs`, then giving up
// as no answer. Answers are kept a while, so a show looked up again is not asked again
// (docs/features/podcast-links.md, "Apple's limits"; OV-297).
export interface AppleCallBudgetOptions {
  perMinute: number;
  mostWaitMs: number;
  keepMs: (url: string) => number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const WINDOW_MS = 60_000;
const MOST_KEPT = 500;

export class AppleBudgetSpentError extends Error {
  constructor() {
    super("Apple's directory is busy; try again in a moment");
  }
}

export function appleCallBudget(fetchJson: (url: string) => Promise<unknown>, options: AppleCallBudgetOptions) {
  const calls: number[] = [];
  const kept = new Map<string, { until: number; value: unknown }>();

  const take = async (): Promise<void> => {
    const deadline = options.now() + options.mostWaitMs;
    for (;;) {
      const now = options.now();
      while (calls.length > 0 && calls[0]! <= now - WINDOW_MS) calls.shift();
      if (calls.length < options.perMinute) {
        calls.push(now);
        return;
      }
      const freeAt = calls[0]! + WINDOW_MS;
      if (freeAt > deadline) throw new AppleBudgetSpentError();
      await options.sleep(freeAt - now);
    }
  };

  return async (url: string): Promise<unknown> => {
    const hit = kept.get(url);
    if (hit !== undefined && hit.until > options.now()) return hit.value;
    await take();
    const value = await fetchJson(url);
    if (kept.size >= MOST_KEPT) kept.delete(kept.keys().next().value!);
    kept.set(url, { until: options.now() + options.keepMs(url), value });
    return value;
  };
}

const HOUR_MS = 60 * 60_000;

// Well under Apple's ~20 a minute, since a deploy can briefly run two machines. A show's episode
// list changes as it publishes, so it is kept an hour; a search for a show's name, a day.
export const APPLE_BUDGET: AppleCallBudgetOptions = {
  perMinute: 15,
  mostWaitMs: 15_000,
  keepMs: (url) => (url.includes("/lookup?") ? HOUR_MS : 24 * HOUR_MS),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
