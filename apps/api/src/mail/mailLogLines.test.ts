import test from "node:test";
import assert from "node:assert/strict";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { MailDeliveryError } from "./brevoMailer.js";

const EMAIL = "reader@example.com";

const askForLink = (testApp: TestApp) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", payload: { email: EMAIL, surface: "web" } });

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a magic link sent is logged at info with its surface and purpose, and never its address or link", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  await askForLink(testApp);

  const [sent] = saying(lines, "magic link sent");
  assert.deepEqual({ level: sent!.level, surface: sent!.surface, purpose: sent!.purpose }, { level: LOG_LEVELS.info, surface: "web", purpose: "signIn" });
  const logged = JSON.stringify(lines);
  assert.doesNotMatch(logged, /reader@example\.com/);
  assert.doesNotMatch(logged, new RegExp(testApp.mailer.lastToken()));
  await testApp.close();
});

test("a second link inside the cooldown is logged at warn as held back, though the caller is answered the same", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  await askForLink(testApp);

  const again = await askForLink(testApp);

  assert.equal(again.statusCode, 202);
  const [held] = saying(lines, "magic link held back");
  assert.deepEqual({ level: held!.level, reason: held!.reason }, { level: LOG_LEVELS.warn, reason: "cooldown" });
  assert.equal(saying(lines, "magic link sent").length, 1);
  await testApp.close();
});

test("mail that can't be sent is an error, logged and answered as one, and never names the address", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  testApp.mailer.failNext(new MailDeliveryError("Brevo answered 503"));

  const response = await askForLink(testApp);

  assert.equal(response.statusCode, 500);
  const [unhandled] = saying(lines, "unhandled error");
  assert.equal(unhandled!.level, LOG_LEVELS.error);
  assert.match(JSON.stringify(unhandled!.err), /Brevo answered 503/);
  assert.equal(saying(lines, "magic link sent").length, 0);
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
  await testApp.close();
});
