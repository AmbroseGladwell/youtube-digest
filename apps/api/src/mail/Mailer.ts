import type { AuthSurface, VerificationPurpose } from "@overview/domain";

// When "createAccount" is honoured: docs/features/sign-in.md, "Which mail an address gets".
export type MagicLinkPurpose = "signIn" | "createAccount";

export interface MagicLinkMail {
  to: string;
  link: string;
  code: string | null;
  surface: AuthSurface;
  purpose: MagicLinkPurpose;
  firstName: string | null;
  expiresAt: string;
}

export type AccountMail =
  | { kind: "verificationCode"; to: string; code: string; expiresAt: string; supportEmail: string; purpose: VerificationPurpose }
  | { kind: "emailChangeCode"; to: string; code: string; expiresAt: string }
  | { kind: "emailTaken"; to: string }
  | { kind: "noAccount"; to: string; createAccountLink: string }
  | { kind: "emailChanged"; to: string; newEmail: string; changedAt: string; revertLink: string; supportEmail: string };

export interface Mailer {
  sendMagicLink(mail: MagicLinkMail): Promise<void>;
  sendAccountMail(mail: AccountMail): Promise<void>;
}
