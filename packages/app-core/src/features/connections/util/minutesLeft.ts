const MINUTE_MS = 60 * 1000;

export function minutesLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / MINUTE_MS));
}

export function minutesLeftPhrase(minutes: number): string {
  return minutes === 1 ? "1 more minute" : `${minutes} more minutes`;
}
