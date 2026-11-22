import type { AccountMail, MagicLinkMail, Mailer } from "./Mailer.js";

export interface RecordingMailer extends Mailer {
  sent: MagicLinkMail[];
  accountMails: AccountMail[];
  lastAccountCode(): string;
  lastRevertToken(): string;
  lastToken(): string;
  lastCode(): string;
  failNext(error: Error): void;
}

export const makeRecordingMailer = (): RecordingMailer => {
  const sent: MagicLinkMail[] = [];
  const accountMails: AccountMail[] = [];
  const failures: Error[] = [];
  return {
    sent,
    accountMails,
    sendAccountMail: async (mail) => {
      const failure = failures.shift();
      if (failure !== undefined) {
        throw failure;
      }
      accountMails.push(mail);
    },
    lastAccountCode: () => {
      const last = accountMails.at(-1);
      if (last === undefined || !("code" in last)) {
        throw new Error("no account code has been sent");
      }
      return last.code;
    },
    lastRevertToken: () => {
      const last = accountMails.at(-1);
      if (last === undefined || last.kind !== "emailChanged") {
        throw new Error("no email-changed notice has been sent");
      }
      return new URLSearchParams(new URL(last.revertLink).hash.slice(1)).get("token")!;
    },
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
    lastCode: () => {
      const code = sent.at(-1)?.code;
      if (code === undefined || code === null) {
        throw new Error("no code has been sent");
      }
      return code;
    },
    lastToken: () => {
      const last = sent.at(-1);
      if (last === undefined) {
        throw new Error("no magic link has been sent");
      }
      return new URLSearchParams(new URL(last.link).hash.slice(1)).get("token")!;
    },
  };
};
