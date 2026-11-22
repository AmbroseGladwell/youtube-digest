import { z } from "zod";
import { Plan } from "./Plan.js";

// This UTC month's messages against the plan's allowance (docs/architecture/tiers.md).
export const ChatUsage = z.object({
  plan: Plan,
  resetsOn: z.iso.date(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  // OV-376: the share of the month's usage spent, which can pass 1 on the last answer; absent from servers before it.
  share: z.number().nonnegative().optional(),
  // Whether a library or project question has room for its worst case (OV-376, design 376h).
  libraryFits: z.boolean().optional(),
});
export type ChatUsage = z.infer<typeof ChatUsage>;
