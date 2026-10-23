export const usageMonth = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

export const nextUsageMonth = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

export const secondsToNextUsageMonth = (now: Date): number =>
  Math.max(1, Math.ceil((Date.parse(nextUsageMonth(now)) - now.getTime()) / 1000));
