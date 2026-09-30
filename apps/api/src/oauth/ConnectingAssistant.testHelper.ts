import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { LightMyRequestResponse } from "fastify";
import type { TestApp } from "../testing/createTestApp.testHelper.js";
import type { TestAccount } from "../testing/TestAccount.testHelper.js";
import { s256Challenge } from "./verifierMatches.js";

export const ASSISTANT_REDIRECT_URI = "https://assistant.test/callback";

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface Authorization {
  verifier: string;
  state: string;
  consentId: string;
}

export interface ConnectingAssistant {
  clientId: string;
  clientSecret: string | null;
  authorize(params?: Record<string, string>): Promise<LightMyRequestResponse>;
  startAuthorization(params?: Record<string, string>): Promise<Authorization>;
  approveAs(account: TestAccount, authorization: Authorization): Promise<URL>;
  token(form: Record<string, string>): Promise<LightMyRequestResponse>;
  exchange(code: string, verifier: string, extra?: Record<string, string>): Promise<LightMyRequestResponse>;
  connect(account: TestAccount): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<LightMyRequestResponse>;
  revoke(token: string): Promise<LightMyRequestResponse>;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

export const postForm = (testApp: TestApp, url: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  testApp.app.inject({
    method: "POST",
    url,
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    payload: form(fields),
  });

export const putOnPlan = (testApp: TestApp, account: TestAccount, plan: "free" | "plus") =>
  testApp.sql.query("update accounts set plan = $2 where id = $1", [account.accountId, plan]);

// An MCP client as Claude would be one: it registers itself, sends the reader to authorize,
// and trades what comes back for tokens (docs/features/mcp-connector.md).
export async function makeConnectingAssistant(
  testApp: TestApp,
  registration: Record<string, unknown> = { token_endpoint_auth_method: "none" },
): Promise<ConnectingAssistant> {
  const registered = await testApp.app.inject({
    method: "POST",
    url: "/oauth/register",
    payload: { client_name: "Claude", redirect_uris: [ASSISTANT_REDIRECT_URI], grant_types: ["authorization_code", "refresh_token"], ...registration },
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const { client_id: clientId, client_secret: clientSecret = null } = registered.json();
  const credentials = (): Record<string, string> =>
    clientSecret === null ? { client_id: clientId } : { client_id: clientId, client_secret: clientSecret };

  const authorize = (params: Record<string, string> = {}) =>
    testApp.app.inject({ method: "GET", url: `/oauth/authorize?${form(params)}` });

  const startAuthorization = async (params: Record<string, string> = {}): Promise<Authorization> => {
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(8).toString("hex");
    const response = await authorize({
      response_type: "code",
      client_id: clientId,
      redirect_uri: ASSISTANT_REDIRECT_URI,
      code_challenge: s256Challenge(verifier),
      code_challenge_method: "S256",
      state,
      scope: "overviews:read",
      ...params,
    });
    assert.equal(response.statusCode, 302, response.body);
    const consentId = /\/connect\/([^/?#]+)$/.exec(response.headers.location as string)?.[1];
    assert.ok(consentId !== undefined, `sent to consent: ${response.headers.location}`);
    return { verifier, state, consentId };
  };

  const approveAs = async (account: TestAccount, authorization: Authorization): Promise<URL> => {
    const decided = await account.inject({
      method: "POST",
      url: `/api/oauth/requests/${authorization.consentId}/decision`,
      body: { approve: true },
    });
    assert.equal(decided.statusCode, 200, decided.body);
    return new URL(decided.json().redirectTo);
  };

  const token = (fields: Record<string, string>) => postForm(testApp, "/oauth/token", { ...credentials(), ...fields });

  const exchange = (code: string, verifier: string, extra: Record<string, string> = {}) =>
    token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: ASSISTANT_REDIRECT_URI, ...extra });

  return {
    clientId,
    clientSecret,
    authorize,
    startAuthorization,
    approveAs,
    token,
    exchange,
    connect: async (account) => {
      const authorization = await startAuthorization();
      const back = await approveAs(account, authorization);
      const response = await exchange(back.searchParams.get("code")!, authorization.verifier);
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    },
    refresh: (refreshToken) => token({ grant_type: "refresh_token", refresh_token: refreshToken }),
    revoke: (revoked) => postForm(testApp, "/oauth/revoke", { ...credentials(), token: revoked }),
  };
}
