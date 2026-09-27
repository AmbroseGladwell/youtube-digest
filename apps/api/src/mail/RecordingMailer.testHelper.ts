import type { MagicLinkMail, Mailer } from "./Mailer.js";

export interface RecordingMailer extends Mailer {
  sent: MagicLinkMail[];
  // The token the last link carried, as the reader would find it in the mail.
  lastToken(): string;
}

export function makeRecordingMailer(): RecordingMailer {
  const sent: MagicLinkMail[] = [];
  return {
    sent,
    sendMagicLink: async (mail) => {
      sent.push(mail);
    },
    lastToken: () => {
      const last = sent.at(-1);
      if (last === undefined) {
        throw new Error("no magic link has been sent");
      }
      return new URLSearchParams(new URL(last.link).hash.slice(1)).get("token")!;
    },
  };
}
