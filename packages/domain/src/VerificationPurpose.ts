import { z } from "zod";

// Only the mail differs; the verification is the same (docs/features/account-deletion.md).
export const VerificationPurpose = z.enum(["emailChange", "deleteAccount"]);
export type VerificationPurpose = z.infer<typeof VerificationPurpose>;

export const VerificationRequest = z.object({
  purpose: VerificationPurpose.default("emailChange"),
});
export type VerificationRequest = z.infer<typeof VerificationRequest>;
