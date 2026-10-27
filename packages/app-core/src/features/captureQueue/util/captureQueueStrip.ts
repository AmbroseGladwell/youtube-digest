import type { CaptureQueueStrip } from "../types/CaptureQueueStrip.js";
import type { QueueHold } from "../types/QueueHold.js";

export type QueueNotice = { kind: "checked"; playlists: number; queued: number } | { kind: "done"; made: number };

export interface CaptureQueueStripInput {
  making: { title: string; step: string; stepProgress: number } | null;
  // Every video still waiting, then the ones the queue can make now, the ones past their
  // playlist's pace for today, and the ones waiting for the reader to choose them, each
  // without the one being made.
  waiting: number;
  ready: number;
  tomorrow: number;
  forYou: { waiting: number; playlists: string[] };
  failed: number;
  skipped: number;
  paused: boolean;
  needsKey: boolean;
  // Signed out, the device has made the trial's overviews: an account comes before any key.
  trialSpent: boolean;
  // Waiting at a limit, and whether the extension would be a way around it here.
  hold: QueueHold | null;
  viaExtension: boolean;
  batch: { done: number } | null;
  notice: QueueNotice | null;
  attentionDismissed: boolean;
}

// Which of the strip's states the queue is in, most pressing first. Null says nothing at
// all, which is most of the time (docs/features/capture-queue.md, "The strip").
export function captureQueueStrip(input: CaptureQueueStripInput): CaptureQueueStrip | null {
  const { making, waiting, ready, tomorrow, forYou, failed, skipped, paused, needsKey, trialSpent, hold, viaExtension, batch, notice, attentionDismissed } =
    input;

  if (making !== null) {
    const done = batch?.done ?? 0;
    const total = done + 1 + ready;
    return {
      kind: "making",
      position: done + 1,
      total,
      step: making.step,
      title: making.title,
      progress: Math.round(((done + making.stepProgress) / total) * 100),
      tomorrow,
    };
  }
  if (waiting > 0 && trialSpent) return { kind: "trialSpent", waiting };
  if (waiting > 0 && needsKey) return { kind: "noKey", waiting };
  if (waiting > 0 && paused) return { kind: "paused", waiting };
  if (waiting > 0 && hold !== null) return { kind: "held", hold, waiting, viaExtension };
  if (notice?.kind === "checked") return notice;
  if (ready === 0 && failed + skipped > 0 && batch !== null && !attentionDismissed) {
    return { kind: "attention", failed, skipped };
  }
  if (ready === 0 && tomorrow > 0) return { kind: "doneForToday", tomorrow };
  if (ready === 0 && forYou.waiting > 0) return { kind: "waitingForYou", ...forYou };
  if (notice?.kind === "done") return notice;
  return null;
}
