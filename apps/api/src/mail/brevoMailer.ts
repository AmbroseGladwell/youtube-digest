import { magicLinkEmail } from "./magicLinkEmail.js";
import { parseMailSender } from "./mailSender.js";
import type { Mailer } from "./Mailer.js";

export interface BrevoMailerOptions {
  apiKey: string;
  from: string;
  fetch?: typeof fetch | undefined;
}

export class MailDeliveryError extends Error {}

// Brevo over its one HTTP call, with no SDK: a transactional message is one POST
// (docs/features/sign-in.md).
export function createBrevoMailer({ apiKey, from, fetch: fetchImpl = globalThis.fetch }: BrevoMailerOptions): Mailer {
  const sender = parseMailSender(from);
  return {
    sendMagicLink: async (mail) => {
      const { subject, text, html } = magicLinkEmail(mail);
      const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          sender: sender.name === null ? { email: sender.email } : { name: sender.name, email: sender.email },
          to: [{ email: mail.to }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      if (!response.ok) {
        throw new MailDeliveryError(`Brevo answered ${response.status}`);
      }
    },
  };
}
