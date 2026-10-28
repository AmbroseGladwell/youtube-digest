import { z } from "zod";

// Signed out, a reader sees no overviews, and starts only the first, on us, through
// onboarding (docs/architecture/tiers.md, "Counting"). The server counts it against a token it
// issued the device; once an account exists it counts towards that account's plan.
export const TRIAL_OVERVIEWS = 1;

export const TRIAL_TOKEN_HEADER = "x-trial-token";

export const TrialToken = z.object({ token: z.string().min(1) });
export type TrialToken = z.infer<typeof TrialToken>;
