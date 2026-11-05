import { z } from "zod";

// A code typed from a mail, for the step-up and for the new address alike
// (docs/features/account-changes.md).
export const CodeRequest = z.object({
  code: z.string().min(1),
});
export type CodeRequest = z.infer<typeof CodeRequest>;
