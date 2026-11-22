import { z } from "zod";
import { Plan } from "./Plan.js";

// This UTC month's messages against the plan's allowance (docs/architecture/tiers.md).
export const ChatUsage = z.object({
  plan: Plan,
  resetsOn: z.iso.date(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
});
export type ChatUsage = z.infer<typeof ChatUsage>;
