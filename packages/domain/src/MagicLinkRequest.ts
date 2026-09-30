import { z } from "zod";
import { AuthIntent } from "./AuthIntent.js";
import { AuthSurface } from "./AuthSurface.js";
import { ConsentPath } from "./consentPath.js";
import { FirstName } from "./FirstName.js";

export const MagicLinkRequest = z.object({
  email: z.string().min(1),
  surface: AuthSurface,
  intent: AuthIntent.default("signIn"),
  firstName: FirstName.optional(),
  returnTo: ConsentPath.optional(),
});
export type MagicLinkRequest = z.input<typeof MagicLinkRequest>;
