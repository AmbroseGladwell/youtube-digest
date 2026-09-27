import { z } from "zod";

// What consuming a magic link answers. A web link has signed the browser in, by a cookie
// the response set. An extension link has signed nothing in yet: it hands over a code
// for the panel to exchange, because the panel is the shell that asked and the tab the
// link opened in is only the messenger (docs/features/sign-in.md).
export const SignedIn = z.discriminatedUnion("surface", [
  z.object({
    surface: z.literal("web"),
    email: z.string(),
    expiresAt: z.string(),
  }),
  z.object({
    surface: z.literal("extension"),
    email: z.string(),
    linkCode: z.string(),
    linkCodeExpiresAt: z.string(),
  }),
]);
export type SignedIn = z.infer<typeof SignedIn>;
