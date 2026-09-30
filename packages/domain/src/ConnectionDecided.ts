import { z } from "zod";

export const ConnectionDecided = z.object({
  redirectTo: z.string(),
});
export type ConnectionDecided = z.infer<typeof ConnectionDecided>;
