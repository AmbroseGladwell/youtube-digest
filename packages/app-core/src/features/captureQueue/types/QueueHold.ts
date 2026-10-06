import { z } from "zod";

// The queue stopped asking and is waiting for a limit to reset, with every waiting video kept
// as waiting rather than failed: at our server's daily safety cap, or for the moment it asked
// us to slow down (docs/features/capture-queue.md, "Waiting at a limit").
export const QueueHoldReason = z.enum(["serverCap", "serverBusy"]);
export type QueueHoldReason = z.infer<typeof QueueHoldReason>;

export const QueueHold = z.object({
  reason: QueueHoldReason,
  // Epoch milliseconds: the moment the limit resets, in the reader's clock.
  resumesAt: z.number().int().positive(),
});
export type QueueHold = z.infer<typeof QueueHold>;
