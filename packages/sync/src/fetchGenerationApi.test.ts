import test from "node:test";
import assert from "node:assert/strict";
import type { OverviewUsage } from "@overview/domain";
import { createFetchGenerationApi } from "./fetchGenerationApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; method: string | undefined; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), method: init?.method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const usage: OverviewUsage = {
  plan: "free",
  resetsOn: "2026-11-01",
  ours: { used: 1, limit: 5 },
  own: { used: 2, limit: 10 },
};

const API = "https://overview.example";

test("a reservation posts the overview's id and answers with the month's counts", async () => {
  const { sent, fetch } = answering(200, usage);
  const api = createFetchGenerationApi({ baseUrl: API, fetch });

  assert.deepEqual(await api.reserve("a-overview"), usage);
  assert.deepEqual(sent[0], { url: `${API}/api/overview-reservations`, method: "POST", body: { overviewId: "a-overview" } });
});

test("saving a share sends its token with the overview's id", async () => {
  const { sent, fetch } = answering(200, usage);
  const api = createFetchGenerationApi({ baseUrl: API, fetch });

  await api.reserve("a-overview", "AbCdEfGhIjKlMnOp");

  assert.deepEqual(sent[0]!.body, { overviewId: "a-overview", shareToken: "AbCdEfGhIjKlMnOp" });
});

test("releasing deletes the reservation, and its empty answer is fine", async () => {
  const { sent, fetch } = answering(204, null);
  const api = createFetchGenerationApi({ baseUrl: API, fetch });

  await api.release("a-overview");

  assert.deepEqual([sent[0]!.url, sent[0]!.method], [`${API}/api/overview-reservations/a-overview`, "DELETE"]);
});

test("a spent quota rejects with which quota and when it resets", async () => {
  const { fetch } = answering(429, {
    error: { code: "too_many_requests", message: "spent", details: { quota: "ours", resetsOn: "2026-11-01", retryAfterSeconds: 60 } },
  });
  const api = createFetchGenerationApi({ baseUrl: API, fetch });

  await assert.rejects(
    api.reserve("a-overview"),
    (error) => isSyncRequestError(error) && error.details?.quota === "ours" && error.details?.resetsOn === "2026-11-01",
  );
});

test("the server says whether it makes overviews on its own key, and the account's counts", async () => {
  const { sent, fetch } = answering(200, { available: true });
  const api = createFetchGenerationApi({ baseUrl: API, fetch });

  assert.deepEqual(await api.status(), { available: true });
  assert.equal(sent[0]!.url, `${API}/api/generations`);
});
