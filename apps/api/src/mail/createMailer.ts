import type { MailConfig } from "../loadConfig.js";
import { createLogMailer } from "./logMailer.js";
import type { Mailer } from "./Mailer.js";
import { createBrevoMailer } from "./brevoMailer.js";

export function createMailer(config: MailConfig): Mailer {
  switch (config.transport) {
    case "log":
      return createLogMailer();
    case "brevo":
      return createBrevoMailer({ apiKey: config.brevoApiKey, from: config.from });
  }
}
