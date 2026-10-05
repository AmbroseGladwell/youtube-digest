import type { AuthSurface } from "@overview/domain";

// "createAccount" only when there is no account yet: an address that already has one is
// sent the ordinary sign-in mail whatever it asked for (docs/features/sign-in.md).
export type MagicLinkPurpose = "signIn" | "createAccount";

export interface MagicLinkMail {
  to: string;
  link: string;
  // A web mail's code, for signing in a browser other than the one the link opens in.
  code: string | null;
  surface: AuthSurface;
  purpose: MagicLinkPurpose;
  firstName: string | null;
  expiresAt: string;
}

export interface Mailer {
  sendMagicLink(mail: MagicLinkMail): Promise<void>;
}
