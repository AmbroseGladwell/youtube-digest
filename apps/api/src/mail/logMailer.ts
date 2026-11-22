import type { Mailer } from "./Mailer.js";

export const createLogMailer = (log: (line: string) => void = console.error): Mailer => {
  return {
    sendMagicLink: async ({ to, link, code, surface, purpose }) => {
      log(`magic link for ${to} (${surface}, ${purpose}): ${link}${code === null ? "" : ` code ${code}`}`);
    },
    sendAccountMail: async (mail) => {
      switch (mail.kind) {
        case "verificationCode":
          log(`${mail.kind} (${mail.purpose}) for ${mail.to}: code ${mail.code}`);
          return;
        case "emailChangeCode":
          log(`${mail.kind} for ${mail.to}: code ${mail.code}`);
          return;
        case "emailTaken":
          log(`emailTaken for ${mail.to}`);
          return;
        case "noAccount":
          log(`noAccount for ${mail.to}: create ${mail.createAccountLink}`);
          return;
        case "emailChanged":
          log(`emailChanged for ${mail.to} (now ${mail.newEmail}): revert ${mail.revertLink}`);
          return;
      }
    },
  };
};
