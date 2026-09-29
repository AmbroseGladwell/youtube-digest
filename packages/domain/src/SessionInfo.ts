import { z } from "zod";

export const SessionInfo = z.object({
  accountId: z.string(),
  email: z.string(),
  firstName: z.string().nullable().default(null),
  expiresAt: z.string(),
});
export type SessionInfo = z.infer<typeof SessionInfo>;
