import test from "node:test";
import assert from "node:assert/strict";
import type { ClientErrorBatch } from "@overview/domain";
import { createFetchErrorsApi } from "./fetchErrorsApi.js";
import { isSyncTransportError } from "./SyncRequestError.js";

const batch: ClientErrorBatch = {
  context: { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" },
  errors: [
    {
      source: "uncaught",
      type: "TypeError",
      message: "x is not a function",
      handled: false,
      frames: [],
      trail: [],
      at: "2026-10-01T09:00:00.000Z",
    },
  ],
};

test("a batch is posted to /api/errors, without a session when there is none, and can be sent to outlive the page", async () => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 204 });
  };
  const api = createFetchErrorsApi({ baseUrl: "https://overview.example/", fetch });

  await api.send(batch, { keepalive: true });

  assert.equal(sent[0]!.url, "https://overview.example/api/errors");
  assert.deepEqual(JSON.parse(sent[0]!.init.body as string), batch);
  assert.ok(!("authorization" in (sent[0]!.init.headers as Record<string, string>)));
  assert.equal(sent[0]!.init.keepalive, true);
});

test("a call that never reached the server still says which id it was sent with, so the error can name it", async () => {
  const fetch = async (): Promise<Response> => {
    throw new TypeError("Failed to fetch");
  };
  const api = createFetchErrorsApi({ baseUrl: "https://overview.example", fetch, newRequestId: () => "request-1" });

  const failed = await api.send(batch).catch((error: unknown) => error);

  assert.ok(isSyncTransportError(failed));
  assert.equal(failed.requestId, "request-1");
});
