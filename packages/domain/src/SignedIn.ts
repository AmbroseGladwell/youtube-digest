import { z } from "zod";

// An extension link hands the panel a code to exchange (docs/features/sign-in.md).
export const SignedIn = z.discriminatedUnion("surface", [
  z.object({
    surface: z.literal("web"),
    accountId: z.string(),
    email: z.string(),
    firstName: z.string().nullable().default(null),
    expiresAt: z.string(),
  }),
  z.object({
    surface: z.literal("extension"),
    email: z.string(),
    firstName: z.string().nullable().default(null),
    linkCode: z.string(),
    linkCodeExpiresAt: z.string(),
  }),
]);
export type SignedIn = z.infer<typeof SignedIn>;
