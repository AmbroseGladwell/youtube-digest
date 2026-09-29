import test from "node:test";
import assert from "node:assert/strict";
import { createBrevoMailer, MailDeliveryError } from "./brevoMailer.js";

const mail = {
  to: "reader@example.com",
  link: "https://overview.example/sign-in#token=t",
  surface: "web" as const,
  purpose: "signIn" as const,
  firstName: null,
  expiresAt: "2026-09-26T09:15:00.000Z",
};

test("a magic link is one POST to Brevo, from the configured sender, with the key in its header", async () => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const mailer = createBrevoMailer({
    apiKey: "xkeysib-key",
    from: "The Overview <signin@overview.example>",
    fetch: async (url, init) => {
      sent.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ messageId: "1" }), { status: 201 });
    },
  });

  await mailer.sendMagicLink(mail);

  assert.equal(sent[0]!.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal((sent[0]!.init.headers as Record<string, string>)["api-key"], "xkeysib-key");
  const body = JSON.parse(sent[0]!.init.body as string);
  assert.deepEqual(body.sender, { name: "The Overview", email: "signin@overview.example" });
  assert.deepEqual(body.to, [{ email: "reader@example.com" }]);
  assert.equal(body.subject, "Sign in to The Overview");
  assert.ok(body.textContent.includes(mail.link));
  assert.ok(body.htmlContent.includes("href="));
});

test("a refusal from Brevo is an error, not a link the reader never gets", async () => {
  const mailer = createBrevoMailer({
    apiKey: "xkeysib-key",
    from: "signin@overview.example",
    fetch: async () => new Response("{}", { status: 401 }),
  });

  await assert.rejects(mailer.sendMagicLink(mail), MailDeliveryError);
});
