import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MAX_CLIENT_ERROR_BATCH, type SentClientError } from "@overview/domain";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { LOG_LEVELS, recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const AT = "2026-09-26T08:59:58.000Z";
const context = { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" } as const;
const error: SentClientError = {
  source: "failedRequest",
  type: "SyncRequestError",
  message: "The overview is newer than this app",
  handled: true,
  frames: [{ function: "useSetOverviewStateMutation", file: "assets/index-Bx3k9.js", line: 1, column: 4021 }],
  requestId: "5b0d2c1e-8f3a-4c6d-9e7b-1a2b3c4d5e6f",
  apiErrorCode: "record_newer_than_client",
  status: 409,
  trail: [{ name: "mcp.consentScreen.shown", at: AT }],
  at: AT,
};

const anonymously = (testApp: Awaited<ReturnType<typeof createTestApp>>, payload: unknown) =>
  testApp.app.inject({
    method: "POST",
    url: "/api/errors",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: payload as object,
  });

test("a signed-in reader's error is passed on under their account id, with the failing call's id and the trail before it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/errors", body: { context, errors: [error] } });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(testApp.errorSink.captured, [
    { errors: [error], source: { accountId: account.accountId, context, geoAddress: "127.0.0.0" } },
  ]);
  await testApp.close();
});

test("a reader with no account still has their errors reported, under no id", async () => {
  const testApp = await createTestApp();

  const response = await anonymously(testApp, { context, errors: [error] });

  assert.equal(response.statusCode, 204);
  assert.equal(testApp.errorSink.captured[0]!.source.accountId, null);
  await testApp.close();
});

test("a session that has expired doesn't stop an error being reported, without an account", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/errors",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), authorization: "Bearer not-a-session" },
    payload: { context, errors: [error] },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(testApp.errorSink.captured[0]!.source.accountId, null);
  await testApp.close();
});

test("what the client sent is redacted again, a trail entry outside the catalogue and a made-up code are dropped", async () => {
  const testApp = await createTestApp();

  await anonymously(testApp, {
    context,
    errors: [
      {
        ...error,
        message: `Couldn't save "My private note" from https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
        apiErrorCode: "reader wrote this",
        trail: [{ name: "Opened my video about divorce", at: AT }, ...error.trail],
      },
    ],
  });

  const [captured] = testApp.errorSink.captured[0]!.errors;
  assert.equal(captured!.message, "Couldn't save <text> from <url>");
  assert.ok(!("apiErrorCode" in captured!));
  assert.deepEqual(captured!.trail, error.trail);
  await testApp.close();
});

test("a batch that is not a batch is refused whole: a frame holding an address, no errors, or too many", async () => {
  const testApp = await createTestApp();

  for (const payload of [
    { context, errors: [{ ...error, frames: [{ function: "f", file: "https://overview.test/reader/1", line: 1, column: 1 }] }] },
    { context, errors: [] },
    { context, errors: Array(MAX_CLIENT_ERROR_BATCH + 1).fill(error) },
  ]) {
    assert.equal((await anonymously(testApp, payload)).statusCode, 400);
  }
  assert.deepEqual(testApp.errorSink.captured, []);
  await testApp.close();
});

test("the error tracker being down never fails the request", async () => {
  const testApp = await createTestApp();
  testApp.errorSink.failing = true;

  assert.equal((await anonymously(testApp, { context, errors: [error] })).statusCode, 204);
  await testApp.close();
});

test("an address sending more than thirty batches a minute is throttled", async () => {
  const testApp = await createTestApp();

  for (let sent = 0; sent < 30; sent++) {
    assert.equal((await anonymously(testApp, { context, errors: [error] })).statusCode, 204);
  }
  const throttled = await anonymously(testApp, { context, errors: [error] });

  assert.equal(throttled.statusCode, 429);
  assert.equal(testApp.errorSink.captured.length, 30);
  await testApp.close();
});

test("a warning is logged at warn under the reader's session and never passed on to error tracking", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const session = await makeSession(testApp.sql, { now: testApp.clock.now });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/errors",
    headers: session.headers,
    payload: {
      context: { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" },
      errors: [],
      warnings: [
        {
          name: "narrationFellBack",
          reason: "requestFailed",
          requestId: "5f0c2a9e-0000-4000-8000-000000000001",
          apiErrorCode: "unavailable",
          at: "2026-10-02T09:00:00.000Z",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 204);
  const [warned] = lines.filter(({ msg }) => msg === "client warning");
  assert.equal(warned!.level, LOG_LEVELS.warn);
  assert.deepEqual(warned!.clientWarning, { name: "narrationFellBack", reason: "requestFailed", apiErrorCode: "unavailable" });
  assert.equal(warned!.failedRequestId, "5f0c2a9e-0000-4000-8000-000000000001");
  assert.equal(warned!.accountId, session.accountId);
  assert.equal(warned!.surface, "extension");
  assert.deepEqual(testApp.errorSink.captured, []);
  await testApp.close();
});
