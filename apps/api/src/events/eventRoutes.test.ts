import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MAX_ANALYTICS_BATCH_EVENTS } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";

const AT = "2026-09-26T08:59:58.000Z";
const context = { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" } as const;

test("a signed-in reader's events are passed on under their account id, with what the batch says about the app", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/events",
    body: {
      context,
      events: [
        { name: "mcp.consentScreen.shown", props: {}, at: AT },
        { name: "mcp.consentScreen.declined", props: { plan: "free" }, at: AT },
      ],
    },
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(testApp.eventSink.captured, [
    {
      events: [
        { name: "mcp.consentScreen.shown", props: {}, at: AT },
        { name: "mcp.consentScreen.declined", props: { plan: "free" }, at: AT },
      ],
      source: { accountId: account.accountId, context, geoAddress: "127.0.0.0" },
    },
  ]);
  await testApp.close();
});

const ANONYMOUS_ID = "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const sendWithoutSession = (testApp: Awaited<ReturnType<typeof createTestApp>>, payload: object) =>
  testApp.app.inject({
    method: "POST",
    url: "/api/events",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload,
  });

test("a reader with no session and no anonymous id sends nothing: their usage waits for their consent", async () => {
  const testApp = await createTestApp();

  const response = await sendWithoutSession(testApp, {
    context,
    events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }],
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});

test("a reader with no account who agreed to share is counted under their anonymous id", async () => {
  const testApp = await createTestApp();

  const response = await sendWithoutSession(testApp, {
    context,
    anonymousId: ANONYMOUS_ID,
    events: [{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: AT }],
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(testApp.eventSink.captured, [
    {
      events: [{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: AT }],
      source: { accountId: null, anonymousId: ANONYMOUS_ID, context, geoAddress: "127.0.0.0" },
    },
  ]);
  await testApp.close();
});

test("a signed-in reader is counted under their account, whatever anonymous id the batch carries", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, anonymousId: ANONYMOUS_ID, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }] },
  });

  assert.deepEqual(
    testApp.eventSink.captured.map(({ source }) => source),
    [{ accountId: account.accountId, context, geoAddress: "127.0.0.0" }],
  );
  await testApp.close();
});

test("an anonymous id that isn't a random id is refused whole", async () => {
  const testApp = await createTestApp();

  const response = await sendWithoutSession(testApp, {
    context,
    anonymousId: "reader@example.com",
    events: [{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: AT }],
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});

test("an address sending more than sixty anonymous batches a minute is throttled", async () => {
  const testApp = await createTestApp();
  const send = () =>
    sendWithoutSession(testApp, {
      context,
      anonymousId: ANONYMOUS_ID,
      events: [{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: AT }],
    });

  for (let sent = 0; sent < 60; sent++) {
    assert.equal((await send()).statusCode, 204);
  }
  const throttled = await send();

  assert.equal(throttled.statusCode, 429);
  assert.equal(testApp.eventSink.captured.length, 60);
  await testApp.close();
});

test("an event the catalogue doesn't have, or carrying text it doesn't declare, costs only itself", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/events",
    body: {
      context,
      events: [
        { name: "mcp.consentScreen.approved", props: {}, at: AT },
        { name: "reader.opened", props: {}, at: AT },
        { name: "mcp.consentScreen.approved", props: { videoId: "dQw4w9WgXcQ" }, at: AT },
        { name: "mcp.consentScreen.declined", props: { plan: "https://evil.test/" }, at: AT },
      ],
    },
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(
    testApp.eventSink.captured.flatMap(({ events }) => events.map(({ name }) => name)),
    ["mcp.consentScreen.approved"],
  );
  await testApp.close();
});

test("what the app dropped is logged, not passed on as an event", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }], dropped: 4 },
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(
    testApp.eventSink.captured.flatMap(({ events }) => events.map(({ name }) => name)),
    ["mcp.consentScreen.shown"],
  );
  await testApp.close();
});

test("nothing is passed on when every event in the batch was refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, events: [{ name: "reader.opened", props: {}, at: AT }] },
  });

  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});

test("a batch that is not a batch is refused whole: an unknown context field, no events, or too many", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const one = { name: "mcp.consentScreen.approved", props: {}, at: AT };

  for (const body of [
    { context: { ...context, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, events: [one] },
    { context, events: [] },
    { context, events: Array(MAX_ANALYTICS_BATCH_EVENTS + 1).fill(one) },
  ]) {
    const response = await account.inject({ method: "POST", url: "/api/events", body });
    assert.equal(response.statusCode, 400);
  }
  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});

test("the analytics service being down never fails the reader's request", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  testApp.eventSink.failing = true;

  const response = await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, events: [{ name: "mcp.settingsConnections.revoked", props: {}, at: AT }] },
  });

  assert.equal(response.statusCode, 204);
  await testApp.close();
});

test("an account sending more than sixty batches a minute is throttled", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const send = () =>
    account.inject({
      method: "POST",
      url: "/api/events",
      body: { context, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }] },
    });

  for (let sent = 0; sent < 60; sent++) {
    assert.equal((await send()).statusCode, 204);
  }
  const throttled = await send();

  assert.equal(throttled.statusCode, 429);
  assert.equal(testApp.eventSink.captured.length, 60);
  await testApp.close();
});

test("an account that turned sharing off has its events dropped on the server, whatever its devices send", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { analyticsOptOut: true, analyticsOptOutChangedAt: AT, updatedAt: AT },
  });

  const response = await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }] },
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(testApp.eventSink.captured, []);
  assert.equal(lines.filter(({ msg }) => msg === "client event").length, 0);
  assert.deepEqual(
    lines.filter(({ msg }) => msg === "analytics opt-out set").map(({ analyticsOptOut }) => analyticsOptOut),
    [true],
  );
  assert.equal(lines.filter(({ msg }) => msg === "client events dropped for opt-out").length, 1);
  await testApp.close();
});

test("turning sharing back on lets the account's events through again", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  for (const [analyticsOptOut, updatedAt] of [
    [true, "2026-09-26T09:00:00.000Z"],
    [false, "2026-09-26T09:00:01.000Z"],
  ] as const) {
    await account.inject({
      method: "PUT",
      url: "/api/settings",
      body: { analyticsOptOut, analyticsOptOutChangedAt: updatedAt, updatedAt },
    });
  }

  await account.inject({
    method: "POST",
    url: "/api/events",
    body: { context, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }] },
  });

  assert.equal(testApp.eventSink.captured.length, 1);
  await testApp.close();
});

test("a reader without an account saying no is one log line with the app's context and no id", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/events/declined",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { context },
  });

  assert.equal(response.statusCode, 204);
  const [declined] = lines.filter(({ msg }) => msg === "analytics declined");
  assert.deepEqual(
    { surface: declined!.surface, layout: declined!.layout, accountId: declined!.accountId, anonymousId: declined!.anonymousId },
    { surface: "extension", layout: "panel", accountId: undefined, anonymousId: undefined },
  );
  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});

test("a decline carrying anything but the app's context is refused", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/events/declined",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { context, anonymousId: ANONYMOUS_ID },
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});
