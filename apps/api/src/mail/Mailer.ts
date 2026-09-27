import type { AuthSurface } from "@overview/domain";

export interface MagicLinkMail {
  to: string;
  link: string;
  surface: AuthSurface;
  expiresAt: string;
}

export interface Mailer {
  sendMagicLink(mail: MagicLinkMail): Promise<void>;
}
