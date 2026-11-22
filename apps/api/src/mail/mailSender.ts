export interface MailSender {
  name: string | null;
  email: string;
}

const NAMED = /^\s*(.*?)\s*<([^<>\s]+)>\s*$/;

// MAIL_FROM may be "Name <address>" or a bare address, and Brevo wants the two apart.
export const parseMailSender = (from: string): MailSender => {
  const named = NAMED.exec(from);
  if (named !== null) {
    const name = named[1]!.replace(/^"|"$/g, "");
    return { name: name === "" ? null : name, email: named[2]! };
  }
  return { name: null, email: from.trim() };
};
