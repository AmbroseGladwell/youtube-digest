import { z } from "zod";

// Kept beside the library, never in it, because signing in empties the no-account library.
export const SignedOutTrial = z.object({
  token: z.string().min(1).nullable(),
});
export type SignedOutTrial = z.infer<typeof SignedOutTrial>;

export const NO_TRIAL: SignedOutTrial = { token: null };
