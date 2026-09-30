import test from "node:test";
import assert from "node:assert/strict";
import { hashToken } from "../auth/hashToken.js";
import { createTestApp, TEST_APP_URL, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { ASSISTANT_REDIRECT_URI, makeConnectingAssistant, postForm, putOnPlan } from "./ConnectingAssistant.testHelper.js";
import { AUTHORIZATION_CODE_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./connectionTimings.js";
import { resolveAccessToken } from "./resolveAccessToken.js";

const plusAccount = async (testApp: TestApp): Promise<TestAccount> => {
  const account = await makeAccount(testApp);
  await putOnPlan(testApp, account, "plus");
  return account;
};

const reads = (testApp: TestApp, accessToken: string) => resolveAccessToken(testApp.sql, accessToken, testApp.clock.now);

test("the authorization server's metadata names every endpoint on the app's origin and requires S256", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({ method: "GET", url: "/.well-known/oauth-authorization-server" });

  assert.equal(response.statusCode, 200);
  const metadata = response.json();
  assert.equal(metadata.issuer, TEST_APP_URL);
  assert.equal(metadata.authorization_endpoint, `${TEST_APP_URL}/oauth/authorize`);
  assert.equal(metadata.token_endpoint, `${TEST_APP_URL}/oauth/token`);
  assert.equal(metadata.registration_endpoint, `${TEST_APP_URL}/oauth/register`);
  assert.equal(metadata.revocation_endpoint, `${TEST_APP_URL}/oauth/revoke`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  await testApp.close();
});

test("the protected resource metadata points the MCP endpoint at this authorization server, at both addresses clients try", async () => {
  const testApp = await createTestApp();

  for (const url of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
    const response = await testApp.app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200, url);
    assert.equal(response.json().resource, `${TEST_APP_URL}/mcp`);
    assert.deepEqual(response.json().authorization_servers, [TEST_APP_URL]);
  }
  await testApp.close();
});

test("a public client registers with no secret, and a confidential one gets a secret that is only kept hashed", async () => {
  const testApp = await createTestApp();

  const publicClient = await makeConnectingAssistant(testApp, { token_endpoint_auth_method: "none" });
  const confidential = await makeConnectingAssistant(testApp, { token_endpoint_auth_method: "client_secret_post" });

  assert.equal(publicClient.clientSecret, null);
  assert.ok(confidential.clientSecret !== null);
  const [row] = await testApp.sql.query<{ client_secret_hash: string }>(
    "select client_secret_hash from oauth_clients where id = $1",
    [confidential.clientId],
  );
  assert.equal(row!.client_secret_hash, hashToken(confidential.clientSecret));
  await testApp.close();
});

test("registering a redirect that is not https, or that points at another machine over http, is refused", async () => {
  const testApp = await createTestApp();

  for (const uri of ["http://example.com/cb", "javascript:alert(1)", "https://assistant.test/cb#fragment"]) {
    const response = await testApp.app.inject({ method: "POST", url: "/oauth/register", payload: { redirect_uris: [uri] } });
    assert.equal(response.statusCode, 400, uri);
    assert.equal(response.json().error, "invalid_redirect_uri");
  }
  assert.deepEqual(await testApp.sql.query("select id from oauth_clients"), []);
  await testApp.close();
});

test("registering with no redirect, or asking for a grant this server does not offer, is refused as bad metadata", async () => {
  const testApp = await createTestApp();

  for (const payload of [{}, { redirect_uris: [ASSISTANT_REDIRECT_URI], grant_types: ["client_credentials"] }]) {
    const response = await testApp.app.inject({ method: "POST", url: "/oauth/register", payload });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_client_metadata");
  }
  await testApp.close();
});

test("authorizing sends the reader to the app's consent page", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);

  const { consentId } = await assistant.startAuthorization();

  const [row] = await testApp.sql.query<{ client_id: string; decided_at: string | null }>(
    "select client_id, decided_at from oauth_authorizations where id = $1",
    [consentId],
  );
  assert.equal(row!.client_id, assistant.clientId);
  assert.equal(row!.decided_at, null);
  await testApp.close();
});

test("an unknown client, or a redirect it did not register, is shown an error and never redirected", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);

  const unknown = await assistant.authorize({ client_id: "nobody", redirect_uri: ASSISTANT_REDIRECT_URI, response_type: "code" });
  const elsewhere = await assistant.authorize({ client_id: assistant.clientId, redirect_uri: "https://evil.test/cb", response_type: "code" });

  for (const response of [unknown, elsewhere]) {
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers.location, undefined);
  }
  await testApp.close();
});

test("authorizing without PKCE goes back to the client as an error carrying its state", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);

  const response = await assistant.authorize({
    client_id: assistant.clientId,
    redirect_uri: ASSISTANT_REDIRECT_URI,
    response_type: "code",
    state: "abc",
  });

  assert.equal(response.statusCode, 302);
  const back = new URL(response.headers.location as string);
  assert.equal(`${back.origin}${back.pathname}`, ASSISTANT_REDIRECT_URI);
  assert.equal(back.searchParams.get("error"), "invalid_request");
  assert.equal(back.searchParams.get("state"), "abc");
  assert.equal(back.searchParams.get("iss"), TEST_APP_URL);
  await testApp.close();
});

test("asking for another resource or another scope is refused back to the client", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const base = { client_id: assistant.clientId, redirect_uri: ASSISTANT_REDIRECT_URI, response_type: "code", code_challenge_method: "S256", code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" };

  const resource = await assistant.authorize({ ...base, resource: "https://elsewhere.test/mcp" });
  const scope = await assistant.authorize({ ...base, scope: "overviews:write" });

  assert.equal(new URL(resource.headers.location as string).searchParams.get("error"), "invalid_target");
  assert.equal(new URL(scope.headers.location as string).searchParams.get("error"), "invalid_scope");
  await testApp.close();
});

test("a Plus reader who approves sends the assistant back with a code, its state and the issuer", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const authorization = await assistant.startAuthorization();

  const back = await assistant.approveAs(reader, authorization);

  assert.equal(`${back.origin}${back.pathname}`, ASSISTANT_REDIRECT_URI);
  assert.ok(back.searchParams.get("code"));
  assert.equal(back.searchParams.get("state"), authorization.state);
  assert.equal(back.searchParams.get("iss"), TEST_APP_URL);
  await testApp.close();
});

test("the code trades for a read-only access token that reads as the approving account", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);

  const tokens = await assistant.connect(reader);

  assert.equal(tokens.token_type, "Bearer");
  assert.equal(tokens.scope, "overviews:read");
  assert.equal(tokens.expires_in, 3600);
  const access = await reads(testApp, tokens.access_token);
  assert.equal(access?.accountId, reader.accountId);
  await testApp.close();
});

test("the token endpoint's answers are never cached", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(reader, authorization);

  const response = await assistant.exchange(back.searchParams.get("code")!, authorization.verifier);

  assert.equal(response.headers["cache-control"], "no-store");
  await testApp.close();
});

test("a connection's tokens are kept only as hashes", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);

  const tokens = await assistant.connect(await plusAccount(testApp));

  const hashes = (await testApp.sql.query<{ token_hash: string }>("select token_hash from connection_tokens")).map((row) => row.token_hash);
  assert.deepEqual(hashes.sort(), [hashToken(tokens.access_token), hashToken(tokens.refresh_token)].sort());
  await testApp.close();
});

test("a code presented with the wrong verifier is refused", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);

  const response = await assistant.exchange(back.searchParams.get("code")!, "x".repeat(43));

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "invalid_grant");
  await testApp.close();
});

test("a code presented with a different redirect than it was issued for is refused", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);

  const response = await assistant.exchange(back.searchParams.get("code")!, authorization.verifier, {
    redirect_uri: "https://assistant.test/other",
  });

  assert.equal(response.json().error, "invalid_grant");
  await testApp.close();
});

test("a code is good for a minute", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);

  testApp.clock.advance(AUTHORIZATION_CODE_TTL_MS);
  const response = await assistant.exchange(back.searchParams.get("code")!, authorization.verifier);

  assert.equal(response.json().error, "invalid_grant");
  await testApp.close();
});

test("a code exchanged a second time is refused and revokes the connection the first exchange made", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);
  const code = back.searchParams.get("code")!;
  const first = (await assistant.exchange(code, authorization.verifier)).json();

  const second = await assistant.exchange(code, authorization.verifier);

  assert.equal(second.json().error, "invalid_grant");
  assert.equal(await reads(testApp, first.access_token), null);
  await testApp.close();
});

test("a code issued to one client cannot be spent by another", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const thief = await makeConnectingAssistant(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);

  const response = await thief.exchange(back.searchParams.get("code")!, authorization.verifier);

  assert.equal(response.json().error, "invalid_grant");
  await testApp.close();
});

test("a confidential client that leaves out its secret is refused as an unauthenticated client", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp, { token_endpoint_auth_method: "client_secret_post" });

  const response = await postForm(testApp, "/oauth/token", {
    client_id: assistant.clientId,
    grant_type: "refresh_token",
    refresh_token: "anything",
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "invalid_client");
  await testApp.close();
});

test("a confidential client may present its secret by HTTP Basic instead", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp, { token_endpoint_auth_method: "client_secret_basic" });
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(await plusAccount(testApp), authorization);
  const basic = Buffer.from(`${assistant.clientId}:${assistant.clientSecret}`).toString("base64");

  const response = await postForm(
    testApp,
    "/oauth/token",
    { grant_type: "authorization_code", code: back.searchParams.get("code")!, code_verifier: authorization.verifier },
    { authorization: `Basic ${basic}` },
  );

  assert.equal(response.statusCode, 200, response.body);
  await testApp.close();
});

test("a grant type this server does not offer is refused as unsupported", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);

  const response = await assistant.token({ grant_type: "client_credentials" });

  assert.equal(response.json().error, "unsupported_grant_type");
  await testApp.close();
});

test("refreshing hands out a new pair, and the old refresh token is spent", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));

  const refreshed = await assistant.refresh(tokens.refresh_token);

  assert.equal(refreshed.statusCode, 200, refreshed.body);
  const next = refreshed.json();
  assert.notEqual(next.access_token, tokens.access_token);
  assert.notEqual(next.refresh_token, tokens.refresh_token);
  assert.ok(await reads(testApp, next.access_token));
  await testApp.close();
});

test("a spent refresh token presented again revokes the whole connection", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));
  const next = (await assistant.refresh(tokens.refresh_token)).json();

  const replay = await assistant.refresh(tokens.refresh_token);

  assert.equal(replay.json().error, "invalid_grant");
  assert.equal(await reads(testApp, next.access_token), null);
  assert.equal((await assistant.refresh(next.refresh_token)).json().error, "invalid_grant");
  await testApp.close();
});

test("a refresh token lapses after thirty days unused", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));

  testApp.clock.advance(REFRESH_TOKEN_TTL_MS);

  assert.equal((await assistant.refresh(tokens.refresh_token)).json().error, "invalid_grant");
  await testApp.close();
});

test("an access token stops reading after its hour", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));

  testApp.clock.advance(tokens.expires_in * 1000);

  assert.equal(await reads(testApp, tokens.access_token), null);
  await testApp.close();
});

test("a reader who leaves Plus loses the connection on its next request and cannot refresh it", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const tokens = await assistant.connect(reader);

  await putOnPlan(testApp, reader, "free");

  assert.equal(await reads(testApp, tokens.access_token), null);
  assert.equal((await assistant.refresh(tokens.refresh_token)).json().error, "invalid_grant");
  await testApp.close();
});

test("a reader who leaves Plus between approving and the exchange gets no tokens", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const reader = await plusAccount(testApp);
  const authorization = await assistant.startAuthorization();
  const back = await assistant.approveAs(reader, authorization);

  await putOnPlan(testApp, reader, "free");
  const response = await assistant.exchange(back.searchParams.get("code")!, authorization.verifier);

  assert.equal(response.json().error, "invalid_grant");
  await testApp.close();
});

test("the assistant revoking either token ends the connection", async () => {
  const testApp = await createTestApp();

  for (const which of ["access_token", "refresh_token"] as const) {
    const assistant = await makeConnectingAssistant(testApp);
    const tokens = await assistant.connect(await plusAccount(testApp));

    const response = await assistant.revoke(tokens[which]);

    assert.equal(response.statusCode, 200);
    assert.equal(await reads(testApp, tokens.access_token), null, which);
  }
  await testApp.close();
});

test("a client cannot revoke another client's connection, and is answered the same as if it had", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const other = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));

  const response = await other.revoke(tokens.refresh_token);

  assert.equal(response.statusCode, 200);
  assert.ok(await reads(testApp, tokens.access_token));
  await testApp.close();
});

test("a session token is not an access token", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);

  const sessionToken = reader.headers.authorization!.replace(/^Bearer /, "");

  assert.equal(await reads(testApp, sessionToken), null);
  await testApp.close();
});

test("an access token is not a session: the sync API refuses it", async () => {
  const testApp = await createTestApp();
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(await plusAccount(testApp));

  const response = await testApp.app.inject({
    method: "GET",
    url: "/api/changes?since=0",
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("registering is limited per address, and answered in the protocol's own error shape", async () => {
  const testApp = await createTestApp();
  const register = () =>
    testApp.app.inject({ method: "POST", url: "/oauth/register", payload: { redirect_uris: [ASSISTANT_REDIRECT_URI] } });
  for (let i = 0; i < 20; i++) {
    assert.equal((await register()).statusCode, 201);
  }

  const response = await register();

  assert.equal(response.statusCode, 429);
  assert.equal(response.json().error, "too_many_requests");
  assert.ok(response.headers["retry-after"]);
  await testApp.close();
});
