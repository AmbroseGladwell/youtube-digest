import type { MagicLinkMail } from "./Mailer.js";
import { transactionalEmailHtml } from "./transactionalEmailHtml.js";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

// Design OV-88. The extension's mail says where the code will appear, because the tab the
// link opens is not the thing that asked (docs/features/sign-in.md).
// A web mail also carries a code, for when the mail is read somewhere other than the browser
// that asked (docs/features/sign-in.md, "A code in the web mail").
export function magicLinkEmail({ link, code, surface, purpose, firstName }: MagicLinkMail): EmailContent {
  const creating = purpose === "createAccount";
  const siteUrl = new URL(link).origin;
  const subject = creating ? "Finish creating your account on The Overview" : "Sign in to The Overview";
  const greeting = creating && firstName !== null ? `Hi ${firstName},` : null;
  const body = creating
    ? "Here is your link to finish creating your account on The Overview."
    : "Here is your link to sign in to The Overview.";
  const label = creating ? "Create my account" : "Sign in";
  const finish =
    surface === "extension"
      ? "The page it opens will show a code to enter in the extension."
      : "It signs in the browser you open it in.";
  const codeLead = "Or enter this code on the page you asked from:";
  const notes = [
    `It works once, for the next fifteen minutes. ${finish}`,
    "If you didn’t ask for this, ignore it: nothing happens until the link is opened.",
  ];
  const reason = creating
    ? "You’re getting this because someone asked to create an account on The Overview with this address."
    : "You’re getting this because someone asked to sign in to The Overview with this address.";

  const text = [
    ...(greeting === null ? [] : [greeting, ""]),
    body,
    "",
    `${label}:`,
    link,
    "",
    ...(code === null ? [] : [codeLead, code, ""]),
    notes[0],
    "",
    notes[1],
    "",
    "—",
    `The Overview · ${siteUrl}`,
    reason,
  ].join("\n");

  return {
    subject,
    text,
    html: transactionalEmailHtml({
      subject,
      preview: creating
        ? "Your link to finish creating your account, valid for 15 minutes."
        : "Your sign-in link, valid for 15 minutes.",
      greeting,
      heading: creating ? "Finish creating your account" : subject,
      body,
      action: { label, link },
      code: code === null ? null : { lead: codeLead, value: code },
      notes,
      reason,
      siteUrl,
    }),
  };
}
