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

test("the text body carries the link verbatim and the html body escapes it", () => {
  const email = magicLinkEmail(mail);
  assert.equal(email.subject, "Sign in to The Overview");
  assert.ok(email.text.includes("https://overview.example/sign-in#token=a&b"));
  assert.ok(email.html.includes('href="https://overview.example/sign-in#token=a&#38;b"'));
});

test("a link asked for from the extension says where the code will appear", () => {
  assert.match(magicLinkEmail({ ...mail, surface: "extension" }).text, /code to enter in the extension/);
  assert.doesNotMatch(magicLinkEmail(mail).text, /code/);
});

test("a link that creates an account says so and greets the reader by the name they gave", () => {
  const email = magicLinkEmail({ ...mail, purpose: "createAccount", firstName: "Ada <3" });
  assert.equal(email.subject, "Finish creating your account on The Overview");
  assert.ok(email.text.startsWith("Hi Ada <3,\n"));
  assert.ok(email.html.includes("<p>Hi Ada &#60;3,</p>"));
  assert.ok(email.html.includes(">Create my account</a>"));
});

test("a sign-in mail greets nobody, even when the account has a name", () => {
  assert.doesNotMatch(magicLinkEmail({ ...mail, firstName: "Ada" }).text, /Ada/);
});
