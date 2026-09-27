import type { Mailer } from "./Mailer.js";

// Development's transport: the link goes to the server's own output, where the person
// running it is the only reader. Nothing is sent anywhere (docs/features/sign-in.md).
export function createLogMailer(log: (line: string) => void = console.error): Mailer {
  return {
    sendMagicLink: async ({ to, link, surface }) => {
      log(`magic link for ${to} (${surface}): ${link}`);
    },
  };
}
