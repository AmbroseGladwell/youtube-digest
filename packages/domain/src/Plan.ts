import { z } from "zod";

// What a person is paying for, if anything. Free is fully local and BYO-key; Plus buys
// the things that inherently need a server — cross-device sync and audio playback
// (docs/architecture/v1-architecture-decisions.md, "The model"). Nothing sells it yet:
// docs/features/plus-upsell.md says what that means for the controls.
export const Plan = z.enum(["free", "plus"]);
export type Plan = z.infer<typeof Plan>;

export const DEFAULT_PLAN: Plan = "free";
