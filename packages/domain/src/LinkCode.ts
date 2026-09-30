import { z } from "zod";

// A code minted by a shell already signed in, for the extension beside it to exchange
// through the same route an emailed link's code uses (docs/features/sign-in.md).
export const LinkCode = z.object({
  linkCode: z.string(),
  linkCodeExpiresAt: z.string(),
});
export type LinkCode = z.infer<typeof LinkCode>;
