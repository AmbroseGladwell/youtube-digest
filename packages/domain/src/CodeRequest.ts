import { z } from "zod";

// For the step-up and the new address alike (docs/features/account-changes.md).
export const CodeRequest = z.object({
  code: z.string().min(1),
});
export type CodeRequest = z.infer<typeof CodeRequest>;
