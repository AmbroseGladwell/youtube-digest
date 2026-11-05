import type { AccountMail, MagicLinkMail, Mailer } from "./Mailer.js";

export interface RecordingMailer extends Mailer {
  sent: MagicLinkMail[];
  // Every account mail: the step-up and new-address codes, the already-taken notice and the
  // old address's notice with its revert link (docs/features/account-changes.md).
  accountMails: AccountMail[];
  // The code the last account mail carried.
  lastAccountCode(): string;
  // The token the last old-address notice's revert link carried.
  lastRevertToken(): string;
  // The token the last link carried, as the reader would find it in the mail.
  lastToken(): string;
  // The code the last mail carried, when it carried one.
  lastCode(): string;
  // The next send fails the way the mail provider would.
  failNext(error: Error): void;
}

export function makeRecordingMailer(): RecordingMailer {
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
}
