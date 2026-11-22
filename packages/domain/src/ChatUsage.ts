import { z } from "zod";
import { Plan } from "./Plan.js";

// The account's chat messages this UTC month against its plan's allowance
// (docs/architecture/tiers.md).
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
