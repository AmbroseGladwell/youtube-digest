import type { MagicLinkMail } from "./Mailer.js";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Plain words and one link. The extension's mail says where the code will appear, because
// the tab the link opens is not the thing that asked (docs/features/sign-in.md).
export function magicLinkEmail({ link, surface, purpose, firstName }: MagicLinkMail): EmailContent {
  const creating = purpose === "createAccount";
  const greeting = creating && firstName !== null ? `Hi ${firstName},` : null;
  const opening = creating
    ? "Here is your link to finish creating your account on The Overview."
    : "Here is your link to sign in to The Overview.";
  const linkLabel = creating ? "Create my account" : "Sign in";
  const finish =
    surface === "extension"
      ? "The page it opens will show a code to enter in the extension."
      : "It signs in the browser you open it in.";
  const closing = "If you didn't ask for this, ignore it: nothing happens until the link is opened.";
  const expiry = `It works once, for the next fifteen minutes. ${finish}`;

  const lines = [...(greeting === null ? [] : [greeting, ""]), opening, "", link, "", expiry, "", closing];
  return {
    subject: creating ? "Finish creating your account on The Overview" : "Sign in to The Overview",
    text: lines.join("\n"),
    html: [
      ...(greeting === null ? [] : [`<p>${escape(greeting)}</p>`]),
      `<p>${escape(opening)}</p>`,
      `<p><a href="${escape(link)}">${linkLabel}</a></p>`,
      `<p>${escape(expiry)}</p>`,
      `<p>${escape(closing)}</p>`,
    ].join("\n"),
  };
}
