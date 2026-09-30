import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createFetchAuthApi } from "./fetchAuthApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const answering = (status: number, body: unknown) => {
  const sent: Sent[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
    });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

test("asking for a magic link posts the email and the surface, with the client version and no bearer", async () => {
  const { sent, fetch } = answering(202, { accepted: true });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example/", fetch });

  await api.requestMagicLink({
    email: "reader@example.com",
    surface: "extension",
    intent: "createAccount",
    firstName: "Ada",
  });

  assert.deepEqual(sent, [
    {
      url: "https://overview.example/api/auth/magic-link",
      method: "POST",
      headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), "content-type": "application/json" },
      body: { email: "reader@example.com", surface: "extension", intent: "createAccount", firstName: "Ada" },
    },
  ]);
});

test("signing in with a web link answers what the cookie now carries, with no name from a server that sends none", async () => {
  const { fetch } = answering(200, { surface: "web", email: "reader@example.com", expiresAt: "2026-10-26T09:00:00.000Z" });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.signIn("t"), {
    surface: "web",
    email: "reader@example.com",
    firstName: null,
    expiresAt: "2026-10-26T09:00:00.000Z",
  });
});

test("signing in with an extension link answers a code to exchange, not a session", async () => {
  const { fetch } = answering(200, {
    surface: "extension",
    email: "reader@example.com",
    linkCode: "ABCD-EFGH",
    linkCodeExpiresAt: "2026-09-26T09:10:00.000Z",
  });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", fetch });

  const signedIn = await api.signIn("t");

  assert.equal(signedIn.surface, "extension");
  assert.equal(signedIn.surface === "extension" && signedIn.linkCode, "ABCD-EFGH");
});

test("a spent link is refused as link_invalid", async () => {
  const { fetch } = answering(410, { error: { code: "link_invalid", message: "This link has expired or was already used" } });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.signIn("t"), (error) => isSyncRequestError(error) && error.code === "link_invalid");
});

test("exchanging a code hands back the extension's bearer", async () => {
  const { sent, fetch } = answering(200, { token: "bearer-token", email: "reader@example.com", expiresAt: "2026-10-26T09:00:00.000Z" });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", fetch });

  const linked = await api.exchangeLinkCode("abcd-efgh");

  assert.equal(linked.token, "bearer-token");
  assert.deepEqual(sent[0]!.body, { code: "abcd-efgh" });
});

test("signing out sends the bearer it was given and takes no content for an answer", async () => {
  const { sent, fetch } = answering(204, null);
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", token: "bearer-token", fetch });

  await api.signOut();

  assert.equal(sent[0]!.method, "DELETE");
  assert.equal(sent[0]!.url, "https://overview.example/api/session");
  assert.equal(sent[0]!.headers.authorization, "Bearer bearer-token");
});

test("a signed-in shell mints a code for the extension over its own session, with no body", async () => {
  const { sent, fetch } = answering(200, { linkCode: "ABCD-EFGH", linkCodeExpiresAt: "2026-09-26T09:10:00.000Z" });
  const api = createFetchAuthApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.issueLinkCode(), { linkCode: "ABCD-EFGH", linkCodeExpiresAt: "2026-09-26T09:10:00.000Z" });
  assert.deepEqual(sent, [
    {
      url: "https://overview.example/api/session/link-code",
      method: "POST",
      headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
      body: undefined,
    },
  ]);
});
