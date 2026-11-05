import { z } from "zod";

export const EmailChangeReverted = z.object({
  email: z.string(),
});
export type EmailChangeReverted = z.infer<typeof EmailChangeReverted>;

// Why a revert link could not move the account back, said in the error's details so the
// page can say which (docs/features/account-changes.md, "Moving it back").
export const EmailChangeRevertRefusal = z.enum(["expired", "spent", "taken"]);
export type EmailChangeRevertRefusal = z.infer<typeof EmailChangeRevertRefusal>;
