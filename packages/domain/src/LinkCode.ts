import { z } from "zod";

// Minted by a signed-in shell for the extension beside it (docs/features/sign-in.md).
export const LinkCode = z.object({
  linkCode: z.string(),
  linkCodeExpiresAt: z.string(),
});
export type LinkCode = z.infer<typeof LinkCode>;
