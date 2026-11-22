import { z } from "zod";

// Signed out, the trial only reads links: docs/features/onboarding.md, "Any kind of link".
export const TRIAL_READS = 5;
// The same, a UTC day per address across every token: three tokens' worth.
export const TRIAL_READS_PER_ADDRESS_DAILY = 15;

export const TRIAL_TOKEN_HEADER = "x-trial-token";

export const TrialToken = z.object({ token: z.string().min(1) });
export type TrialToken = z.infer<typeof TrialToken>;
