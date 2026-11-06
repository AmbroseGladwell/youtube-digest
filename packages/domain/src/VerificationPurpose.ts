import { z } from "zod";

// What the code to the account's own address is about to allow, so the mail can say so. The
// verification it sets is the same either way (docs/features/account-deletion.md).
export const VerificationPurpose = z.enum(["emailChange", "deleteAccount"]);
export type VerificationPurpose = z.infer<typeof VerificationPurpose>;

export const VerificationRequest = z.object({
  purpose: VerificationPurpose.default("emailChange"),
});
export type VerificationRequest = z.infer<typeof VerificationRequest>;
