import type { QueuedCapture } from "@overview/domain";
import { resumeTimeText } from "../../transcripts/util/resumeTime.js";
import type { CaptureQueueController } from "../useCaptureQueue.js";
import type { QueueRowState } from "../components/QueueRow/QueueRow.js";

export interface QueueRowModel {
  capture: QueuedCapture;
  state: QueueRowState;
  resumeTime?: string;
}

// What waits, after the one being made, each with the words its row shows: the first is
// Next, the rest Waiting, every one says so when there is no key to make it with, and every
// one says when it continues while the queue waits at a limit.
export function waitingRows(queue: Pick<CaptureQueueController, "waiting" | "making" | "needsKey" | "hold">): QueueRowModel[] {
  const makingId = queue.making?.capture.videoId ?? null;
  const resumeTime = queue.hold === null ? undefined : resumeTimeText(new Date(queue.hold.resumesAt));
  return queue.waiting
    .filter((capture) => capture.videoId !== makingId)
    .map((capture, index) => ({
      capture,
      state: queue.needsKey ? "noKey" : resumeTime !== undefined ? "held" : index === 0 ? "next" : "waiting",
      ...(resumeTime === undefined ? {} : { resumeTime }),
    }));
}

export function attentionSummary(attention: QueuedCapture[]): string {
  const failed = attention.filter((capture) => capture.status === "failed").length;
  const skipped = attention.length - failed;
  return [failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
    .filter((part): part is string => part !== null)
    .join(", ");
}
