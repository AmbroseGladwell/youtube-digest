import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { makeConnectingAssistant } from "./ConnectingAssistant.testHelper.js";
import { AUTHORIZATION_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./connectionTimings.js";
import { resolveAccessToken } from "./resolveAccessToken.js";

const reads = (testApp: TestApp, accessToken: string) => resolveAccessToken(testApp.sql, accessToken, testApp.clock.now);

test("the consent screen is told which app is asking, where it will send the reader, and whether it asked to mark overviews", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await makeAccount(testApp);
  const { consentId } = await assistant.startAuthorization();
  const readOnly = await assistant.startAuthorization({ scope: "overviews:read" });

  const response = await reader.inject({ method: "GET", url: `/api/oauth/requests/${consentId}` });
  const readOnlyResponse = await reader.inject({ method: "GET", url: `/api/oauth/requests/${readOnly.consentId}` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().clientName, "Claude");
  assert.equal(response.json().redirectHost, "assistant.test");
  assert.equal(response.json().writes, true);
  assert.equal(readOnlyResponse.json().writes, false);
  await testApp.close();
});

test("a signed-out reader can read the request they are signing in to answer", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const { consentId } = await assistant.startAuthorization();

  const response = await testApp.app.inject({ method: "GET", url: `/api/oauth/requests/${consentId}` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().redirectHost, "assistant.test");
  await testApp.close();
});

test("a signed-out reader cannot answer a request", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const { consentId } = await assistant.startAuthorization();

  const response = await testApp.app.inject({
    method: "POST",
    url: `/api/oauth/requests/${consentId}/decision`,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { approve: false },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("any signed-in reader can approve a connection, whatever their plan", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await makeAccount(testApp);
  const authorization = await assistant.startAuthorization();

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
  const reader = await makeAccount(testApp);
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
  const reader = await makeAccount(testApp);
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
  const reader = await makeAccount(testApp);
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
  const reader = await makeAccount(testApp);
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
  const reader = await makeAccount(testApp);
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
  const owner = await makeAccount(testApp);
  const stranger = await makeAccount(testApp);
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
  const first = await makeAccount(testApp);
  const second = await makeAccount(testApp);

  const firstTokens = await assistant.connect(first);
  const secondTokens = await assistant.connect(second);

  assert.equal((await reads(testApp, firstTokens.access_token))?.accountId, first.accountId);
  assert.equal((await reads(testApp, secondTokens.access_token))?.accountId, second.accountId);
  await testApp.close();
});
