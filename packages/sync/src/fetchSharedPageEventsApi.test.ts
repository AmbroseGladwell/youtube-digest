import test from "node:test";
import assert from "node:assert/strict";
import type { SharedPageEventBatch } from "@overview/domain";
import { createFetchSharedPageEventsApi } from "./fetchSharedPageEventsApi.js";

const batch: SharedPageEventBatch = {
  context: { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" },
  viewId: "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
  events: [{ name: "sharedPage.tabs.switched", props: { tab: "chapters" }, at: "2026-10-02T09:00:00.000Z" }],
};

test("a shared page's batch is posted under its share token, with no bearer, and can outlive the page", async () => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 204 });
  };
  const api = createFetchSharedPageEventsApi({ baseUrl: "https://overview.example", token: "testShareToken01", fetch });

  await api.send(batch, { keepalive: true });

  assert.equal(sent[0]!.url, "https://overview.example/api/shares/testShareToken01/events");
  assert.deepEqual(JSON.parse(sent[0]!.init.body as string), batch);
  assert.equal((sent[0]!.init.headers as Record<string, string>).authorization, undefined);
  assert.equal(sent[0]!.init.keepalive, true);
});
