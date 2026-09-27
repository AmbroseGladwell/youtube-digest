import test from "node:test";
import assert from "node:assert/strict";
import { magicLinkEmail } from "./magicLinkEmail.js";

const mail = {
  to: "reader@example.com",
  link: "https://overview.example/sign-in#token=a&b",
  expiresAt: "2026-09-26T09:15:00.000Z",
};

test("the text body carries the link verbatim and the html body escapes it", () => {
  const email = magicLinkEmail({ ...mail, surface: "web" });
  assert.equal(email.subject, "Sign in to The Overview");
  assert.ok(email.text.includes("https://overview.example/sign-in#token=a&b"));
  assert.ok(email.html.includes('href="https://overview.example/sign-in#token=a&#38;b"'));
});

test("a link asked for from the extension says where the code will appear", () => {
  assert.match(magicLinkEmail({ ...mail, surface: "extension" }).text, /code to enter in the extension/);
  assert.doesNotMatch(magicLinkEmail({ ...mail, surface: "web" }).text, /code/);
});
