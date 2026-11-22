import { z } from "zod";

export const EmailChangeReverted = z.object({
  email: z.string(),
});
export type EmailChangeReverted = z.infer<typeof EmailChangeReverted>;

// docs/features/account-changes.md, "Moving it back".
export const EmailChangeRevertRefusal = z.enum(["expired", "spent", "taken"]);
export type EmailChangeRevertRefusal = z.infer<typeof EmailChangeRevertRefusal>;
