import { z } from "zod";

// The one time the extension's bearer token is handed over (docs/features/sign-in.md).
export const LinkedSession = z.object({
  token: z.string().min(1),
  accountId: z.string(),
  email: z.string(),
  firstName: z.string().nullable().default(null),
  expiresAt: z.string(),
});
export type LinkedSession = z.infer<typeof LinkedSession>;
