import type { AccountMail } from "./Mailer.js";
import type { EmailContent } from "./magicLinkEmail.js";
import { transactionalEmailHtml } from "./transactionalEmailHtml.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// The server has no timezone for the reader, so the time is given in UTC and says so.
export const changedOnLine = (changedAt: string): string => {
  const at = new Date(changedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Changed on ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()} at ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC.`;
};

// Design 14h. Every mail is the OV-88 shell with its own words; the code mails have no
// button, and the old address's notice has one, its way back
// (docs/features/account-changes.md, "The mails"). The step-up's mail says what the code
// is about to allow (design 14h·2, docs/features/account-deletion.md).
export function accountEmail(mail: AccountMail, siteUrl: string): EmailContent {
  switch (mail.kind) {
    case "verificationCode":
      return compose({
        siteUrl,
        subject: "Confirm it’s you",
        preview: "Your code, valid for 15 minutes.",
        heading: "Confirm it’s you",
        body:
          mail.purpose === "deleteAccount"
            ? "Enter this code in Settings to delete your account."
            : "Enter this code in Settings to confirm it’s you before changing your email.",
        code: mail.code,
        action: null,
        notes: [
          "It works once, for the next fifteen minutes.",
          mail.purpose === "deleteAccount"
            ? `If you didn’t ask for this, someone may be signed in as you. Ignore the code: without it your account can’t be deleted. Then sign out of any device you don’t recognise, and write to ${mail.supportEmail}.`
            : `If you didn’t ask for this, someone may be signed in as you. Ignore the code: without it your email can’t be changed. Then sign out of any device you don’t recognise, and write to ${mail.supportEmail}.`,
        ],
        reason:
          mail.purpose === "deleteAccount"
            ? "You’re getting this because someone signed in to your account asked to delete it."
            : "You’re getting this because someone signed in to your account asked to change its email.",
      });
    case "emailChangeCode":
      return compose({
        siteUrl,
        subject: "Confirm your new email",
        preview: "Your code, valid for 15 minutes.",
        heading: "Confirm your new email",
        body: "Enter this code in Settings › Account & sync to move your account to this address.",
        code: mail.code,
        action: null,
        notes: [
          "It works once, for the next fifteen minutes, and only for the account that asked.",
          "If you didn’t ask for this, ignore it: nothing changes until the code is entered.",
        ],
        reason: "You’re getting this because someone asked to move an account on The Overview to this address.",
      });
    case "emailTaken":
      return compose({
        siteUrl,
        subject: "This address already has an account",
        preview: "Nothing has changed.",
        heading: "This address already has an account",
        body: "Someone asked to move an account on The Overview to this address. It already belongs to an account, and an address can only belong to one, so there’s no code.",
        code: null,
        action: null,
        notes: [
          "If it was you, sign in with this address to use the account it already has, or ask again with a different address.",
          "If it wasn’t, ignore this. Nothing has changed.",
        ],
        reason: "You’re getting this because someone asked to move an account on The Overview to this address.",
      });
    case "noAccount":
      return compose({
        siteUrl,
        subject: "There’s no account for this address",
        preview: "No sign-in link, and nothing has been made.",
        heading: "There’s no account for this address",
        body: "Someone asked to sign in to The Overview with this address, but no account uses it, so there’s no sign-in link.",
        code: null,
        action: { label: "Create an account", link: mail.createAccountLink },
        notes: [
          "If it was you, you may have an account under a different address: sign in with that one. Or create an account with this address.",
          "If it wasn’t, ignore this. Nothing has been made.",
        ],
        reason: "You’re getting this because someone asked to sign in to The Overview with this address.",
      });
    case "emailChanged":
      return compose({
        siteUrl,
        subject: "Your email was changed",
        preview: `Your account now signs in with ${mail.newEmail}.`,
        heading: "Your email was changed",
        body: `Your account on The Overview now signs in with ${mail.newEmail}. This address no longer does.`,
        code: null,
        action: { label: "This wasn’t me, move it back", link: mail.revertLink },
        notes: [
          `${changedOnLine(mail.changedAt)} Nothing was signed out: your library, sync and devices carry on as before.`,
          "The button works once, for seven days. It moves the account back to this address and signs out every device.",
          `If the button can’t help, write to ${mail.supportEmail} and we’ll help you get the account back.`,
        ],
        reason: "You’re getting this because the email on your account changed.",
      });
  }
}

interface Composed {
  siteUrl: string;
  subject: string;
  preview: string;
  heading: string;
  body: string;
  code: string | null;
  action: { label: string; link: string } | null;
  notes: string[];
  reason: string;
}

function compose({ siteUrl, subject, preview, heading, body, code, action, notes, reason }: Composed): EmailContent {
  const text = [
    body,
    "",
    ...(code === null ? [] : [code, ""]),
    ...(action === null ? [] : [`${action.label}:`, action.link, ""]),
    ...notes.flatMap((note) => [note, ""]),
    "—",
    `The Overview · ${siteUrl}`,
    reason,
  ].join("\n");
  return {
    subject,
    text,
    html: transactionalEmailHtml({
      subject,
      preview,
      greeting: null,
      heading,
      body,
      action,
      code: code === null ? null : { lead: null, value: code },
      notes,
      reason,
      siteUrl,
    }),
  };
}
