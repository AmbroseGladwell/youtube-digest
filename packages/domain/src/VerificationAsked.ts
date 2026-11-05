import { z } from "zod";

// Whether the session has to prove its inbox before a sensitive change. A fresh or already
// verified session is told no and nothing is sent; otherwise a code went to the account's
// address (docs/features/account-changes.md, "Confirm it's you").
export const VerificationAsked = z.discriminatedUnion("required", [
  z.object({ required: z.literal(false) }),
  z.object({ required: z.literal(true), email: z.string(), expiresAt: z.string() }),
]);
export type VerificationAsked = z.infer<typeof VerificationAsked>;
