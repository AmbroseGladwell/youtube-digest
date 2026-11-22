const MINUTE_MS = 60 * 1000;

export const minutesLeft = (expiresAt: string, now: number): number => {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / MINUTE_MS));
};

export const minutesLeftPhrase = (minutes: number): string => {
  return minutes === 1 ? "1 more minute" : `${minutes} more minutes`;
};
