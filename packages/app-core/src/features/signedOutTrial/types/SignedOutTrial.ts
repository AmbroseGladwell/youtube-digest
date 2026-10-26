import { z } from "zod";

// What this device remembers of its signed-out trial: how many overviews it has made signed
// out, on either key, and the token the server counts the ones on our key against. Kept
// beside the library, never read from it, because signing in empties the no-account
// library into the account (docs/architecture/tiers.md, "Counting").
export const SignedOutTrial = z.object({
  made: z.number().int().min(0),
  token: z.string().min(1).nullable(),
});
export type SignedOutTrial = z.infer<typeof SignedOutTrial>;

export const NO_TRIAL: SignedOutTrial = { made: 0, token: null };
