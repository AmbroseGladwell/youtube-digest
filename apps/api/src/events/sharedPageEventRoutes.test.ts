import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, type Share } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const AT = "2026-10-02T09:00:00.000Z";
const VIEW_ID = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const context = { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" } as const;
const switched = { name: "sharedPage.tabs.switched", props: { tab: "chapters" }, at: AT };

const sendAsVisitor = (testApp: TestApp, token: string, events: unknown[], viewId: string = VIEW_ID) =>
  testApp.app.inject({
    method: "POST",
    url: `/api/shares/${token}/events`,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { context, viewId, events },
  });

const sharedOverview = async (testApp: TestApp) => {
  const account = await makeAccount(testApp);
  const overview = makeOverview();
  const share: Share = (await account.inject({ method: "POST", url: "/api/shares", body: { overview } })).json();
  return { account, overview, share };
};

test("a visitor with no account is counted under their page load, with the shared overview's id and never the token", async () => {
  const testApp = await createTestApp();
  const { overview, share } = await sharedOverview(testApp);

  const response = await sendAsVisitor(testApp, share.token, [switched]);

  assert.equal(response.statusCode, 204);
  assert.deepEqual(testApp.eventSink.captured, [
    {
      events: [{ name: "sharedPage.tabs.switched", props: { tab: "chapters", overviewId: overview.id }, at: AT }],
      source: { accountId: null, viewId: VIEW_ID, context, geoAddress: "127.0.0.0" },
    },
  ]);
  assert.ok(!JSON.stringify(testApp.eventSink.captured).includes(share.token));
  await testApp.close();
});

test("a signed-in visitor is counted under their own account", async () => {
  const testApp = await createTestApp();
  const { share } = await sharedOverview(testApp);
  const visitor = await makeAccount(testApp);

  await visitor.inject({
    method: "POST",
    url: `/api/shares/${share.token}/events`,
    body: { context, viewId: VIEW_ID, events: [switched] },
  });

  assert.equal(testApp.eventSink.captured[0]!.source.accountId, visitor.accountId);
  await testApp.close();
});

test("a stopped link's visitors are still counted against the overview it shared", async () => {
  const testApp = await createTestApp();
  const { account, overview, share } = await sharedOverview(testApp);
  await account.inject({ method: "DELETE", url: `/api/shares/${share.token}` });

  await sendAsVisitor(testApp, share.token, [{ name: "sharedPage.gone.makeChosen", props: {}, at: AT }]);

  assert.deepEqual(testApp.eventSink.captured[0]!.events[0]!.props, { overviewId: overview.id });
  await testApp.close();
});

test("only what happens on a shared page can be said here, and the overview's id is the server's to add", async () => {
  const testApp = await createTestApp();
  const { share } = await sharedOverview(testApp);

  await sendAsVisitor(testApp, share.token, [
    switched,
    { name: "mcp.consentScreen.approved", props: {}, at: AT },
    { name: "reader.tabs.switched", props: { tab: "chapters", overviewId: VIEW_ID }, at: AT },
    { name: "sharedPage.tabs.switched", props: { tab: "chapters", overviewId: VIEW_ID }, at: AT },
  ]);

  assert.deepEqual(
    testApp.eventSink.captured.flatMap(({ events }) => events.map(({ name }) => name)),
    ["sharedPage.tabs.switched"],
  );
  await testApp.close();
});

test("a batch without a view id of the page's own making is refused whole", async () => {
  const testApp = await createTestApp();
  const { share } = await sharedOverview(testApp);

  const response = await sendAsVisitor(testApp, share.token, [switched], "visitor@example.com");

  assert.equal(response.statusCode, 400);
  assert.deepEqual(testApp.eventSink.captured, []);
  await testApp.close();
});
