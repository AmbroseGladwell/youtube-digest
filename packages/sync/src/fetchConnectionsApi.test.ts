import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, REQUEST_ID_HEADER } from "@overview/domain";
import { createFetchConnectionsApi } from "./fetchConnectionsApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const SENT_REQUEST_ID = "5f0c2a9e-request";

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const REQUEST_ID = "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";

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

test("a request is read by its id", async () => {
  const answer = { id: REQUEST_ID, clientName: null, redirectHost: "claude.ai", writes: true, expiresAt: "2026-09-30T10:00:00.000Z" };
  const { sent, fetch } = answering(200, answer);
  const api = createFetchConnectionsApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.request(REQUEST_ID), answer);
  assert.equal(sent[0]!.url, `https://overview.example/api/oauth/requests/${REQUEST_ID}`);
});

test("a decision is a write that carries the client version, which is what stops another site making it", async () => {
  const { sent, fetch } = answering(200, { redirectTo: "https://claude.ai/callback?code=c" });
  const api = createFetchConnectionsApi({ baseUrl: "https://overview.example", fetch, newRequestId: () => SENT_REQUEST_ID });

  const decided = await api.decide(REQUEST_ID, true);

  assert.equal(decided.redirectTo, "https://claude.ai/callback?code=c");
  assert.deepEqual(sent, [
    {
      url: `https://overview.example/api/oauth/requests/${REQUEST_ID}/decision`,
      method: "POST",
      headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), [REQUEST_ID_HEADER]: SENT_REQUEST_ID, "content-type": "application/json" },
      body: { approve: true },
    },
  ]);
});

test("a refused approval says why", async () => {
  const { fetch } = answering(404, { error: { code: "not_found", message: "This request has expired" } });
  const api = createFetchConnectionsApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.decide(REQUEST_ID, true), (error) => isSyncRequestError(error) && error.code === "not_found");
});

test("connections are listed and revoked", async () => {
  const connection = { id: "c1", clientName: "Claude", createdAt: "2026-09-12T09:00:00.000Z", lastUsedAt: "2026-09-30T09:00:00.000Z" };
  const listing = answering(200, { connections: [connection] });
  assert.deepEqual(await createFetchConnectionsApi({ baseUrl: "https://o.example", fetch: listing.fetch }).list(), [connection]);

  const revoking = answering(204, null);
  await createFetchConnectionsApi({ baseUrl: "https://o.example", fetch: revoking.fetch }).revoke("c1");
  assert.equal(revoking.sent[0]!.method, "DELETE");
  assert.equal(revoking.sent[0]!.url, "https://o.example/api/connections/c1");
});
