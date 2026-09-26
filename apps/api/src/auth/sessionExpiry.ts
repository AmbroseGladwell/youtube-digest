const DAY_MS = 24 * 60 * 60 * 1000;

export const sessionExpiry = (now: Date, sessionTtlDays: number): string =>
  new Date(now.getTime() + sessionTtlDays * DAY_MS).toISOString();
