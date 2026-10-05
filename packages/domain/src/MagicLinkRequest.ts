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
  // A reader creating an account who said yes to sharing usage on this device: their
  // anonymous id, linked to the account once it is made (docs/features/analytics-consent.md).
  anonymousId: z.uuid().optional(),
});
export type MagicLinkRequest = z.input<typeof MagicLinkRequest>;
