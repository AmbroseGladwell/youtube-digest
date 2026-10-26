import { z } from "zod";

// Signed out, a reader makes 3 overviews in total on either key, then is offered an account
// (docs/architecture/tiers.md, "Counting"). The device counts all of them; the server counts
// the ones on our key against a token it issued the device.
export const TRIAL_OVERVIEWS = 3;

export const TRIAL_TOKEN_HEADER = "x-trial-token";

export const TrialToken = z.object({ token: z.string().min(1) });
export type TrialToken = z.infer<typeof TrialToken>;
