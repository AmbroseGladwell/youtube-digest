import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_SURFACE_HEADER } from "@overview/domain";
import { createFetchFeedbackApi } from "./fetchFeedbackApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body?: unknown) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetch };
};

test("feedback is posted to the server with the session and the surface", async () => {
  const { calls, fetch } = answering(204);
  const api = createFetchFeedbackApi({ baseUrl: "https://overview.example", token: "session", surface: "web", fetch });

  await api.send({ text: "An idea", surface: "web", kind: "idea" });

  assert.equal(calls[0]!.url, "https://overview.example/api/feedback");
  assert.equal(calls[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { text: "An idea", surface: "web", kind: "idea" });
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer session");
  assert.equal(headers[CLIENT_SURFACE_HEADER], "web");
});

test("twenty in an hour comes back as the server's refusal, with its status", async () => {
  const { fetch } = answering(429, { error: { code: "too_many_requests", message: "Too many" } });
  const api = createFetchFeedbackApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.send({ text: "One more", surface: "web" }), (error) => isSyncRequestError(error) && error.status === 429);
});
