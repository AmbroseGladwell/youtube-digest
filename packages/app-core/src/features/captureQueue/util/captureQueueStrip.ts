import type { CaptureQueueStrip } from "../types/CaptureQueueStrip.js";
import type { QueueHold } from "../types/QueueHold.js";
import type { LimitMessage } from "../../newOverview/util/limitMessage.js";

export type QueueNotice = { kind: "checked"; playlists: number; queued: number } | { kind: "done"; made: number };

export interface CaptureQueueStripInput {
  making: { title: string; step: string; stepProgress: number } | null;
  // Each count leaves out the video being made.
  waiting: number;
  ready: number;
  tomorrow: number;
  forYou: { waiting: number; playlists: string[] };
  failed: number;
  skipped: number;
  paused: boolean;
  needsKey: boolean;
  hold: QueueHold | null;
  limit: LimitMessage | null;
  viaExtension: boolean;
  batch: { done: number } | null;
  notice: QueueNotice | null;
  attentionDismissed: boolean;
}

// The states, most pressing first: docs/features/capture-queue.md, "The strip".
export const captureQueueStrip = (input: CaptureQueueStripInput): CaptureQueueStrip | null => {
  const {
    making,
    waiting,
    ready,
    tomorrow,
    forYou,
    failed,
    skipped,
    paused,
    needsKey,
    hold,
    limit,
    viaExtension,
    batch,
    notice,
    attentionDismissed,
  } = input;

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
  if (waiting > 0 && needsKey) {
    return { kind: "noKey", waiting };
  }
  if (waiting > 0 && hold?.reason === "monthSpent") {
    return { kind: "held", hold, waiting, viaExtension, limit };
  }
  if (waiting > 0 && paused) {
    return { kind: "paused", waiting };
  }
  if (waiting > 0 && hold !== null) {
    return { kind: "held", hold, waiting, viaExtension, limit: null };
  }
  if (notice?.kind === "checked") {
    return notice;
  }
  if (ready === 0 && failed + skipped > 0 && batch !== null && !attentionDismissed) {
    return { kind: "attention", failed, skipped };
  }
  if (ready === 0 && tomorrow > 0) {
    return { kind: "doneForToday", tomorrow };
  }
  if (ready === 0 && forYou.waiting > 0) {
    return { kind: "waitingForYou", ...forYou };
  }
  if (notice?.kind === "done") {
    return notice;
  }
  return null;
};
