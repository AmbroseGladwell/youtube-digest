import { z } from "zod";

// The answer to asking for a new address, the same whether or not that address has an
// account (docs/features/account-changes.md).
export const EmailChangeAsked = z.object({
  accepted: z.literal(true),
  expiresAt: z.string(),
});
export type EmailChangeAsked = z.infer<typeof EmailChangeAsked>;
