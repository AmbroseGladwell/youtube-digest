import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { makeConnectingAssistant, putOnPlan } from "./ConnectingAssistant.testHelper.js";
import { AUTHORIZATION_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./connectionTimings.js";
import { resolveAccessToken } from "./resolveAccessToken.js";

const plusAccount = async (testApp: TestApp): Promise<TestAccount> => {
  const account = await makeAccount(testApp);
  await putOnPlan(testApp, account, "plus");
  return account;
};

const reads = (testApp: TestApp, accessToken: string) => resolveAccessToken(testApp.sql, accessToken, testApp.clock.now);

test("the consent screen is told which app is asking, where it will send the reader, and the reader's plan", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await makeAccount(testApp);
  const { consentId } = await assistant.startAuthorization();

  const response = await reader.inject({ method: "GET", url: `/api/oauth/requests/${consentId}` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().clientName, "Claude");
  assert.equal(response.json().redirectHost, "assistant.test");
  assert.equal(response.json().plan, "free");
  await testApp.close();
});

test("the consent screen needs the reader to be signed in", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const { consentId } = await assistant.startAuthorization();

  const response = await testApp.app.inject({ method: "GET", url: `/api/oauth/requests/${consentId}` });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("a free reader cannot approve a connection, and the request stays open for after they upgrade", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await makeAccount(testApp);
  const authorization = await assistant.startAuthorization();

  const refused = await reader.inject({
    method: "POST",
    url: `/api/oauth/requests/${authorization.consentId}/decision`,
    body: { approve: true },
  });

  assert.equal(refused.statusCode, 403);
  assert.equal(refused.json().error.code, "plan_required");
  await putOnPlan(testApp, reader, "plus");
  const back = await assistant.approveAs(reader, authorization);
  assert.ok(back.searchParams.get("code"));
  await testApp.close();
});

test("declining sends the assistant back with access_denied and no code", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await makeAccount(testApp);
  const authorization = await assistant.startAuthorization();

  const response = await reader.inject({
    method: "POST",
    url: `/api/oauth/requests/${authorization.consentId}/decision`,
    body: { approve: false },
  });

  const back = new URL(response.json().redirectTo);
  assert.equal(back.searchParams.get("error"), "access_denied");
  assert.equal(back.searchParams.get("code"), null);
  assert.equal(back.searchParams.get("state"), authorization.state);
  await testApp.close();
});

test("a request can be answered once", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const authorization = await assistant.startAuthorization();
  await assistant.approveAs(reader, authorization);

  const again = await reader.inject({
    method: "POST",
    url: `/api/oauth/requests/${authorization.consentId}/decision`,
    body: { approve: true },
  });

  assert.equal(again.statusCode, 404);
  assert.equal(again.json().error.code, "not_found");
  await testApp.close();
});

test("a request left unanswered for half an hour lapses", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const { consentId } = await assistant.startAuthorization();

  testApp.clock.advance(AUTHORIZATION_TTL_MS);

  const response = await reader.inject({ method: "GET", url: `/api/oauth/requests/${consentId}` });
  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("a request id that is not one is simply not found", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);

  const response = await reader.inject({ method: "GET", url: "/api/oauth/requests/not-a-uuid" });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("Settings lists the reader's connections by the app's name", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  await assistant.connect(reader);

  const response = await reader.inject({ method: "GET", url: "/api/connections" });

  assert.equal(response.statusCode, 200);
  const { connections } = response.json();
  assert.equal(connections.length, 1);
  assert.equal(connections[0].clientName, "Claude");
  assert.equal(connections[0].createdAt, testApp.clock.now.toISOString());
  await testApp.close();
});

test("a connection whose tokens have all lapsed is not listed", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  await assistant.connect(reader);

  testApp.clock.advance(REFRESH_TOKEN_TTL_MS / 2);
  await reader.inject({ method: "GET", url: "/api/session" });
  testApp.clock.advance(REFRESH_TOKEN_TTL_MS / 2);

  const response = await reader.inject({ method: "GET", url: "/api/connections" });
  assert.deepEqual(response.json().connections, []);
  await testApp.close();
});

test("revoking a connection in Settings cuts its access off straight away", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const tokens = await assistant.connect(reader);
  const [connection] = (await reader.inject({ method: "GET", url: "/api/connections" })).json().connections;

  const response = await reader.inject({ method: "DELETE", url: `/api/connections/${connection.id}` });

  assert.equal(response.statusCode, 204);
  assert.equal(await reads(testApp, tokens.access_token), null);
  assert.equal((await assistant.refresh(tokens.refresh_token)).json().error, "invalid_grant");
  assert.deepEqual((await reader.inject({ method: "GET", url: "/api/connections" })).json().connections, []);
  await testApp.close();
});

test("one reader can neither see nor revoke another's connections", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const owner = await plusAccount(testApp);
  const stranger = await plusAccount(testApp);
  const tokens = await assistant.connect(owner);
  const [connection] = (await owner.inject({ method: "GET", url: "/api/connections" })).json().connections;

  const listed = await stranger.inject({ method: "GET", url: "/api/connections" });
  const revoked = await stranger.inject({ method: "DELETE", url: `/api/connections/${connection.id}` });

  assert.deepEqual(listed.json().connections, []);
  assert.equal(revoked.statusCode, 404);
  assert.ok(await reads(testApp, tokens.access_token));
  await testApp.close();
});

test("each reader's access token reads as that reader alone", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const first = await plusAccount(testApp);
  const second = await plusAccount(testApp);

  const firstTokens = await assistant.connect(first);
  const secondTokens = await assistant.connect(second);

  assert.equal((await reads(testApp, firstTokens.access_token))?.accountId, first.accountId);
  assert.equal((await reads(testApp, secondTokens.access_token))?.accountId, second.accountId);
  await testApp.close();
});
