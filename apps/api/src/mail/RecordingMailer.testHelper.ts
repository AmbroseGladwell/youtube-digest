import type { MagicLinkMail, Mailer } from "./Mailer.js";

export interface RecordingMailer extends Mailer {
  sent: MagicLinkMail[];
  // The token the last link carried, as the reader would find it in the mail.
  lastToken(): string;
  // The next send fails the way the mail provider would.
  failNext(error: Error): void;
}

export function makeRecordingMailer(): RecordingMailer {
  const sent: MagicLinkMail[] = [];
  const failures: Error[] = [];
  return {
    sent,
    sendMagicLink: async (mail) => {
      const failure = failures.shift();
      if (failure !== undefined) {
        throw failure;
      }
      sent.push(mail);
    },
    failNext: (error) => {
      failures.push(error);
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
