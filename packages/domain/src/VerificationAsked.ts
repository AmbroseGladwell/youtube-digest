import { z } from "zod";

// docs/features/account-changes.md, "The email, in four steps".
export const VerificationAsked = z.discriminatedUnion("required", [
  z.object({ required: z.literal(false) }),
  z.object({ required: z.literal(true), email: z.string(), expiresAt: z.string() }),
]);
export type VerificationAsked = z.infer<typeof VerificationAsked>;
