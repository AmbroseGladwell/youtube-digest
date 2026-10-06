const DAY_MS = 24 * 60 * 60 * 1000;

// Our server's daily caps reset at UTC midnight; when a refusal didn't say how long, that is
// how long (docs/architecture/server-side-transcripts.md, "Limits").
export function secondsToNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export const resumesAtFrom = (retryAfterSeconds: number | null, now: Date): Date =>
  new Date(now.getTime() + Math.min(DAY_MS, Math.max(1, retryAfterSeconds ?? secondsToNextUtcDay(now)) * 1000));

// Written out in the reader's own clock, never counted down (docs/features/capture-queue.md).
export const resumeTimeText = (resumesAt: Date): string =>
  resumesAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const serverBusyResumeSentence = (resumesAt: Date): string =>
  `Our server asked us to wait a moment. It can again after ${resumeTimeText(resumesAt)}, or the extension can fetch this one now.`;

export const serverCapResumeSentence = (resumesAt: Date): string =>
  `Our server has fetched as many transcripts for you as it can today. It can again after ${resumeTimeText(resumesAt)}, or the extension can fetch this one now.`;
