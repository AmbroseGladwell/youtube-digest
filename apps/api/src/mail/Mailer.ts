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

// The four mails an account's own changes send: a code to the current address before a
// sensitive change, a code to a new address, the mail a new address gets instead when it
// already has an account, and the notice the old address gets after a change, with its way
// back (docs/features/account-changes.md).
export type AccountMail =
  | { kind: "verificationCode"; to: string; code: string; expiresAt: string; supportEmail: string }
  | { kind: "emailChangeCode"; to: string; code: string; expiresAt: string }
  | { kind: "emailTaken"; to: string }
  | { kind: "emailChanged"; to: string; newEmail: string; changedAt: string; revertLink: string; supportEmail: string };

export interface Mailer {
  sendMagicLink(mail: MagicLinkMail): Promise<void>;
  sendAccountMail(mail: AccountMail): Promise<void>;
}
