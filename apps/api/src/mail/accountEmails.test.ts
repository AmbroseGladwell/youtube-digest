import test from "node:test";
import assert from "node:assert/strict";
import { accountEmail, changedOnLine } from "./accountEmails.js";

const SITE = "https://overview.example";

test("the step-up and new-address mails carry their code large, no button, and their own notes", () => {
  const stepUp = accountEmail(
    {
      kind: "verificationCode",
      to: "reader@example.com",
      code: "R4HN-8T2W",
      expiresAt: "2026-11-05T14:47:00.000Z",
      supportEmail: "help@overview.example",
      purpose: "emailChange",
    },
    SITE,
  );
  assert.equal(stepUp.subject, "Confirm it’s you");
  assert.match(stepUp.html, /<h1[^>]*>Confirm it’s you<\/h1>/);
  assert.ok(stepUp.html.includes(">R4HN-8T2W</p>"));
  assert.ok(!stepUp.html.includes('class="ov-button"'));
  for (const body of [stepUp.html, stepUp.text]) {
    assert.ok(body.includes("Enter this code in Settings to confirm it’s you before changing your email."));
    assert.ok(body.includes("write to help@overview.example"));
  }

  const newAddress = accountEmail(
    { kind: "emailChangeCode", to: "new@example.org", code: "K7QF-2M9X", expiresAt: "2026-11-05T14:47:00.000Z" },
    SITE,
  );
  assert.equal(newAddress.subject, "Confirm your new email");
  assert.ok(newAddress.text.includes("\nK7QF-2M9X\n"));
  assert.ok(newAddress.text.includes("only for the account that asked"));
});

test("the step-up mail for deleting an account says so, and what ignoring the code protects", () => {
  const { subject, html, text } = accountEmail(
    {
      kind: "verificationCode",
      to: "reader@example.com",
      code: "R4HN-8T2W",
      expiresAt: "2026-11-05T14:47:00.000Z",
      supportEmail: "help@overview.example",
      purpose: "deleteAccount",
    },
    SITE,
  );
  assert.equal(subject, "Confirm it’s you");
  for (const body of [html, text]) {
    assert.ok(body.includes("Enter this code in Settings to delete your account."));
    assert.ok(body.includes("without it your account can’t be deleted"));
    assert.ok(body.includes("asked to delete it"));
    assert.ok(!body.includes("changing your email"));
  }
});

test("the already-taken mail carries no code and says nothing has changed", () => {
  const { subject, html, text } = accountEmail({ kind: "emailTaken", to: "new@example.org" }, SITE);
  assert.equal(subject, "This address already has an account");
  assert.ok(!html.includes('class="ov-button"'));
  assert.ok(!html.includes("letter-spacing: 0.12em"));
  assert.ok(text.includes("If it wasn’t, ignore this. Nothing has changed."));
});

test("the no-account mail says there's no link, and its one button creates an account", () => {
  const { subject, html, text } = accountEmail(
    { kind: "noAccount", to: "reader@example.com", createAccountLink: "https://overview.example/create-account" },
    SITE,
  );
  assert.equal(subject, "There’s no account for this address");
  assert.match(html, /<a class="ov-button" href="https:\/\/overview\.example\/create-account"[^>]*>Create an account<\/a>/);
  assert.ok(!html.includes("letter-spacing: 0.12em"));
  assert.ok(text.includes("Create an account:\nhttps://overview.example/create-account\n"));
  for (const body of [html, text]) {
    assert.ok(body.includes("no account uses it, so there’s no sign-in link"));
    assert.ok(body.includes("If it wasn’t, ignore this. Nothing has been made."));
  }
});

test("the old address's notice names the new address, the UTC time, and one button that moves the account back", () => {
  const { subject, html, text } = accountEmail(
    {
      kind: "emailChanged",
      to: "reader@example.com",
      newEmail: "new@example.org",
      changedAt: "2026-11-05T14:32:00.000Z",
      revertLink: "https://overview.example/account/revert#token=a&b",
      supportEmail: "help@overview.example",
    },
    SITE,
  );
  assert.equal(subject, "Your email was changed");
  assert.match(
    html,
    /<a class="ov-button" href="https:\/\/overview\.example\/account\/revert#token=a&#38;b"[^>]*>This wasn’t me, move it back<\/a>/,
  );
  assert.ok(text.includes("This wasn’t me, move it back:\nhttps://overview.example/account/revert#token=a&b\n"));
  for (const body of [html, text]) {
    assert.ok(body.includes("now signs in with new@example.org. This address no longer does."));
    assert.ok(body.includes("Changed on 5 November 2026 at 14:32 UTC. Nothing was signed out"));
    assert.ok(body.includes("works once, for seven days"));
    assert.ok(body.includes("write to help@overview.example"));
  }
});

test("the changed-on line is the date and a UTC time, whatever the server's own zone", () => {
  assert.equal(changedOnLine("2026-01-09T03:05:00.000Z"), "Changed on 9 January 2026 at 03:05 UTC.");
});
