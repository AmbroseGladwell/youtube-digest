import type { QueuedCapture } from "@overview/domain";
import type { CaptureQueueController } from "../useCaptureQueue.js";
import type { QueueRowState } from "../components/QueueRow/QueueRow.js";

export interface QueueRowModel {
  capture: QueuedCapture;
  state: QueueRowState;
}

// What waits, after the one being made, each with the words its row shows: the first is
// Next, the rest Waiting, and every one says so when there is no key to make it with.
export function waitingRows(queue: Pick<CaptureQueueController, "waiting" | "making" | "needsKey">): QueueRowModel[] {
  const makingId = queue.making?.capture.videoId ?? null;
  return queue.waiting
    .filter((capture) => capture.videoId !== makingId)
    .map((capture, index) => ({
      capture,
      state: queue.needsKey ? "noKey" : index === 0 ? "next" : "waiting",
    }));
}

export function attentionSummary(attention: QueuedCapture[]): string {
  const failed = attention.filter((capture) => capture.status === "failed").length;
  const skipped = attention.length - failed;
  return [failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
    .filter((part): part is string => part !== null)
    .join(", ");
}
