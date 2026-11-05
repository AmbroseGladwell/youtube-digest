import { accountEmail } from "./accountEmails.js";
import { magicLinkEmail, type EmailContent } from "./magicLinkEmail.js";
import { parseMailSender } from "./mailSender.js";
import type { AccountMail, MagicLinkMail, Mailer } from "./Mailer.js";

export interface BrevoMailerOptions {
  apiKey: string;
  from: string;
  // The site the account mails name in their footer, where the web app is served from.
  siteUrl: string;
  fetch?: typeof fetch | undefined;
}

export class MailDeliveryError extends Error {}

// Brevo over its one HTTP call, with no SDK: a transactional message is one POST
// (docs/features/sign-in.md).
export function createBrevoMailer({ apiKey, from, siteUrl, fetch: fetchImpl = globalThis.fetch }: BrevoMailerOptions): Mailer {
  const sender = parseMailSender(from);
  const send = async (to: string, { subject, text, html }: EmailContent): Promise<void> => {
    const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        sender: sender.name === null ? { email: sender.email } : { name: sender.name, email: sender.email },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    if (!response.ok) {
      throw new MailDeliveryError(`Brevo answered ${response.status}`);
    }
  };
  return {
    sendMagicLink: (mail: MagicLinkMail) => send(mail.to, magicLinkEmail(mail)),
    sendAccountMail: (mail: AccountMail) => send(mail.to, accountEmail(mail, siteUrl)),
  };
}
