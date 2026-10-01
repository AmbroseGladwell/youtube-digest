import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MAX_ANALYTICS_BATCH_EVENTS } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

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

test("a reader with no session sends nothing: usage without an account waits for their consent", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/events",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { context, events: [{ name: "mcp.consentScreen.shown", props: {}, at: AT }] },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(testApp.eventSink.captured, []);
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
