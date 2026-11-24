import { useKeptLinksController } from "../captures/KeptLinksContext.js";
import { useCaptureQueueController } from "./CaptureQueueContext.js";

export interface QueueCount {
  queued: number;
  attention: number;
}

// Null while nothing is queued, so every way in hides itself: docs/features/navigation.md, "The queue".
export const useQueueCount = (): QueueCount | null => {
  const queue = useCaptureQueueController();
  const kept = useKeptLinksController();
  const keptWaiting = kept?.links.filter((link) => link.queueStatus === "waiting").length ?? 0;
  const keptFailed = kept?.links.filter((link) => link.queueStatus === "failed").length ?? 0;
  const making = (queue.making === null ? 0 : 1) + (kept?.making == null ? 0 : 1);
  const queued = queue.waiting.length + keptWaiting + making;
  const attention = queue.attention.length + keptFailed;
  return !queue.available || queued + attention === 0 ? null : { queued, attention };
};
