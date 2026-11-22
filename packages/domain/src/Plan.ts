import { z } from "zod";

// Every plan has every feature; the paid ones sell volume (docs/architecture/tiers.md).
export const Plan = z.enum(["free", "byo-plus", "plus"]);
export type Plan = z.infer<typeof Plan>;

export const DEFAULT_PLAN: Plan = "free";
