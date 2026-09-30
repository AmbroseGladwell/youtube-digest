import { z } from "zod";
import { DEFAULT_PLAN, Plan } from "./Plan.js";

export const SessionInfo = z.object({
  accountId: z.string(),
  email: z.string(),
  firstName: z.string().nullable().default(null),
  expiresAt: z.string(),
  plan: Plan.default(DEFAULT_PLAN),
});
export type SessionInfo = z.infer<typeof SessionInfo>;
