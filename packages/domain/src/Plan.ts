import { z } from "zod";

// What a person is paying for, if anything. Every plan has every feature; the paid ones
// sell volume. BYO Plus sells overviews on the reader's own key, and Plus sells overviews
// on ours (docs/architecture/tiers.md). Nothing sells either yet:
// docs/features/plus-upsell.md says what that means for the controls.
export const Plan = z.enum(["free", "byo-plus", "plus"]);
export type Plan = z.infer<typeof Plan>;

export const DEFAULT_PLAN: Plan = "free";
