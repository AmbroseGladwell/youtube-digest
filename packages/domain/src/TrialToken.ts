import { z } from "zod";

// Signed out, a reader sees no overviews and nothing is made (OV-327): the trial token the
// server issues the device only reads onboarding's link and asks for its topic suggestions.
// Links the trial may ask our server to read (docs/features/onboarding.md, "Any kind of link").
export const TRIAL_READS = 5;
// The same, a UTC day per address across every token: three tokens' worth.
export const TRIAL_READS_PER_ADDRESS_DAILY = 15;

export const TRIAL_TOKEN_HEADER = "x-trial-token";

export const TrialToken = z.object({ token: z.string().min(1) });
export type TrialToken = z.infer<typeof TrialToken>;
