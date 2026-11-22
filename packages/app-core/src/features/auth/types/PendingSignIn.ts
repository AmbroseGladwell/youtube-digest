import { z } from "zod";
import { AuthIntent } from "@overview/domain";

// Why it's kept on the device: docs/features/sign-in.md, "Waiting for the code".
export const PendingSignIn = z.object({
  apiUrl: z.url(),
  email: z.string(),
  intent: AuthIntent,
  firstName: z.string().nullable(),
  sentAt: z.number(),
});
export type PendingSignIn = z.infer<typeof PendingSignIn>;
