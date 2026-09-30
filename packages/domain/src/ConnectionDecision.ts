import { z } from "zod";

export const ConnectionDecision = z.object({
  approve: z.boolean(),
});
export type ConnectionDecision = z.infer<typeof ConnectionDecision>;
