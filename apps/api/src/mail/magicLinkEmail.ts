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
export function magicLinkEmail({ link, surface }: MagicLinkMail): EmailContent {
  const finish =
    surface === "extension"
      ? "The page it opens will show a code to enter in the extension's Settings."
      : "It signs in the browser you open it in.";
  const lines = [
    "Here is your link to sign in to The Overview.",
    "",
    link,
    "",
    `It works once, for the next fifteen minutes. ${finish}`,
    "",
    "If you didn't ask for this, ignore it: nothing happens until the link is opened.",
  ];
  return {
    subject: "Sign in to The Overview",
    text: lines.join("\n"),
    html: [
      "<p>Here is your link to sign in to The Overview.</p>",
      `<p><a href="${escape(link)}">Sign in</a></p>`,
      `<p>It works once, for the next fifteen minutes. ${escape(finish)}</p>`,
      "<p>If you didn't ask for this, ignore it: nothing happens until the link is opened.</p>",
    ].join("\n"),
  };
}
