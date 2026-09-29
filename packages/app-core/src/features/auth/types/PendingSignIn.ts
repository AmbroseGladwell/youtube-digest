import { z } from "zod";
import { AuthIntent } from "@overview/domain";

// A link the extension asked for and has not yet had a code back for. Kept on the device
// because the popup is closed the moment the reader goes to their mail
// (docs/features/sign-in.md, "Waiting for the code").
export const PendingSignIn = z.object({
  apiUrl: z.url(),
  email: z.string(),
  intent: AuthIntent,
  firstName: z.string().nullable(),
  sentAt: z.number(),
});
export type PendingSignIn = z.infer<typeof PendingSignIn>;
