import { z } from "zod";
import { Plan } from "./Plan.js";

// The account's chat messages this UTC month against its plan's allowance
// (docs/architecture/tiers.md).
export const ChatUsage = z.object({
  plan: Plan,
  resetsOn: z.iso.date(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
});
export type ChatUsage = z.infer<typeof ChatUsage>;
