import test from "node:test";
import assert from "node:assert/strict";
import { magicLinkEmail } from "./magicLinkEmail.js";

const mail = {
  to: "reader@example.com",
  link: "https://overview.example/sign-in#token=a&b",
  surface: "web" as const,
  purpose: "signIn" as const,
  firstName: null,
  expiresAt: "2026-09-26T09:15:00.000Z",
};

const escapedLink = "https://overview.example/sign-in#token=a&#38;b";

test("the text body carries the link verbatim on its own line and the html body escapes it", () => {
  const email = magicLinkEmail(mail);
  assert.equal(email.subject, "Sign in to The Overview");
  assert.ok(email.text.includes("\nSign in:\nhttps://overview.example/sign-in#token=a&b\n"));
  assert.ok(email.html.includes(`href="${escapedLink}"`));
  assert.ok(!email.html.includes("token=a&b"));
});

test("a sign-in mail has its heading, one button, the link as text, and both notes", () => {
  const { html, text } = magicLinkEmail(mail);
  assert.match(html, /<h1[^>]*>Sign in to The Overview<\/h1>/);
  assert.match(html, /<a class="ov-button" href="[^"]+"[^>]*>Sign in<\/a>/);
  assert.ok(html.includes(`>${escapedLink}</a>`));
  for (const body of [html, text]) {
    assert.ok(body.includes("Here is your link to sign in to The Overview."));
    assert.ok(body.includes("It works once, for the next fifteen minutes. It signs in the browser you open it in."));
    assert.ok(body.includes("If you didn’t ask for this, ignore it: nothing happens until the link is opened."));
    assert.ok(body.includes("someone asked to sign in to The Overview with this address."));
  }
});

test("the preview line, the mark and the footer links come from the link's own site", () => {
  const { html, text } = magicLinkEmail(mail);
  assert.ok(html.includes("Your sign-in link, valid for 15 minutes."));
  assert.ok(html.includes('src="https://overview.example/email-mark.png"'));
  assert.ok(html.includes('href="https://overview.example/privacy"'));
  assert.ok(html.includes('<html lang="en"'));
  assert.ok(text.endsWith("The Overview · https://overview.example\nYou’re getting this because someone asked to sign in to The Overview with this address."));
});

test("a link asked for from the extension says where the code will appear", () => {
  const email = magicLinkEmail({ ...mail, surface: "extension" });
  for (const body of [email.text, email.html]) {
    assert.ok(body.includes("It works once, for the next fifteen minutes. The page it opens will show a code to enter in the extension."));
  }
  assert.doesNotMatch(magicLinkEmail(mail).text, /code/);
});

test("a link that creates an account says so and greets the reader by the name they gave", () => {
  const email = magicLinkEmail({ ...mail, purpose: "createAccount", firstName: "Ada <3" });
  assert.equal(email.subject, "Finish creating your account on The Overview");
  assert.ok(email.text.startsWith("Hi Ada <3,\n\nHere is your link to finish creating your account on The Overview.\n\nCreate my account:\n"));
  assert.match(email.html, /<p[^>]*>Hi Ada &#60;3,<\/p>/);
  assert.match(email.html, /<h1[^>]*>Finish creating your account<\/h1>/);
  assert.match(email.html, />Create my account<\/a>/);
  assert.ok(email.html.includes("Your link to finish creating your account, valid for 15 minutes."));
  assert.ok(email.html.includes("someone asked to create an account on The Overview with this address."));
});

test("an account made without a name leaves the greeting out", () => {
  const email = magicLinkEmail({ ...mail, purpose: "createAccount" });
  assert.ok(email.text.startsWith("Here is your link to finish creating your account"));
  assert.doesNotMatch(email.html, /Hi /);
});

test("a sign-in mail greets nobody, even when the account has a name", () => {
  const email = magicLinkEmail({ ...mail, firstName: "Ada" });
  assert.doesNotMatch(email.text, /Ada/);
  assert.doesNotMatch(email.html, /Ada/);
});
