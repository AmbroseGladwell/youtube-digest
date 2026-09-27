export interface MailSender {
  name: string | null;
  email: string;
}

const NAMED = /^\s*(.*?)\s*<([^<>\s]+)>\s*$/;

// MAIL_FROM is written the way a mail client shows it, "The Overview <signin@example.com>"
// or a bare address, and Brevo wants the two apart (docs/features/sign-in.md).
export function parseMailSender(from: string): MailSender {
  const named = NAMED.exec(from);
  if (named !== null) {
    const name = named[1]!.replace(/^"|"$/g, "");
    return { name: name === "" ? null : name, email: named[2]! };
  }
  return { name: null, email: from.trim() };
}
