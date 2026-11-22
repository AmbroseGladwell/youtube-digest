import { z } from "zod";

// Each reason and how long it waits: docs/features/capture-queue.md, "Waiting at a limit".
export const QueueHoldReason = z.enum(["serverCap", "serverBusy", "monthSpent"]);
export type QueueHoldReason = z.infer<typeof QueueHoldReason>;

export const QueueHold = z.object({
  reason: QueueHoldReason,
  // Epoch milliseconds.
  resumesAt: z.number().int().positive(),
});
export type QueueHold = z.infer<typeof QueueHold>;
