import test from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ID_HEADER, type AnalyticsEventBatch } from "@overview/domain";
import { createFetchEventsApi } from "./fetchEventsApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const batch: AnalyticsEventBatch = {
  context: { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" },
  events: [{ name: "mcp.consentScreen.approved", props: {}, at: "2026-10-01T09:00:00.000Z" }],
};

const answering = (status: number, body: unknown = null) => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), init: init ?? {} });
    return new Response(body === null ? null : JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

test("a batch is posted to /api/events over the session, and can be sent to outlive the page", async () => {
  const { sent, fetch } = answering(204);
  const api = createFetchEventsApi({ baseUrl: "https://overview.example", token: "bearer", fetch });

  await api.send(batch);
  await api.send(batch, { keepalive: true });

  assert.equal(sent[0]!.url, "https://overview.example/api/events");
  assert.equal(sent[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(sent[0]!.init.body as string), batch);
  assert.equal((sent[0]!.init.headers as Record<string, string>).authorization, "Bearer bearer");
  assert.equal(sent[0]!.init.keepalive, undefined);
  assert.equal(sent[1]!.init.keepalive, true);
});

test("every request carries a fresh id, and a refusal says which id it was sent with", async () => {
  const { sent, fetch } = answering(429, { error: { code: "too_many_requests", message: "Slow down" } });
  let next = 0;
  const api = createFetchEventsApi({ baseUrl: "https://overview.example", fetch, newRequestId: () => `request-${++next}` });

  const refused = await api.send(batch).catch((error: unknown) => error);

  assert.equal((sent[0]!.init.headers as Record<string, string>)[REQUEST_ID_HEADER], "request-1");
  assert.ok(isSyncRequestError(refused));
  assert.equal(refused.requestId, "request-1");
});

test("a no is posted on its own, with the app's context and nothing else", async () => {
  const { sent, fetch } = answering(204);
  const api = createFetchEventsApi({ baseUrl: "https://overview.example", fetch });

  await api.declined(batch.context);

  assert.equal(sent[0]!.url, "https://overview.example/api/events/declined");
  assert.deepEqual(JSON.parse(sent[0]!.init.body as string), { context: batch.context });
  assert.equal((sent[0]!.init.headers as Record<string, string>).authorization, undefined);
});
