import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId, ShareToken, type Share } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { createFetchShareApi } from "./fetchShareApi.js";

interface Sent {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

const answering = (status: number, body: unknown) => {
  const sent: Sent[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const aShare = (overrides: Partial<Share> = {}): Share => ({
  token: ShareToken.parse("k7Qm2x9RfTabcdef"),
  url: "https://overview.example/s/k7Qm2x9RfTabcdef",
  overviewId: OverviewId.parse("c4a9f0d2-7b31-4e68-8f5a-0d1c2b3a4e5f"),
  title: "The Quiet Return of Nuclear Baseload",
  sharedAt: "2026-09-30T11:00:00.000Z",
  updatedAt: "2026-09-30T11:00:00.000Z",
  views: 12,
  contentHash: "a".repeat(64),
  ...overrides,
});

test("the reader's live links are listed, with the session they were made under", async () => {
  const share = aShare();
  const { sent, fetch } = answering(200, { shares: [share] });
  const api = createFetchShareApi({ baseUrl: "https://overview.example/", token: "a-bearer", fetch });

  assert.deepEqual(await api.list(), [share]);
  assert.equal(sent[0]!.url, "https://overview.example/api/shares");
  assert.equal(sent[0]!.headers.authorization, "Bearer a-bearer");
});

test("sharing sends the whole overview, so the server builds the copy rather than trusting one", async () => {
  const overview = makeOverview({ captureReason: "Read before Thursday." });
  const { sent, fetch } = answering(201, aShare());
  const api = createFetchShareApi({ baseUrl: "https://overview.example", fetch });

  await api.share({ overview, transcript: null, narration: null });

  assert.equal(sent[0]!.method, "POST");
  assert.equal(sent[0]!.url, "https://overview.example/api/shares");
  assert.deepEqual((sent[0]!.body as { overview: unknown }).overview, JSON.parse(JSON.stringify(overview)));
});

test("stopping a link names it in the path", async () => {
  const { sent, fetch } = answering(204, null);
  const api = createFetchShareApi({ baseUrl: "https://overview.example", fetch });

  await api.stop("k7Qm2x9RfTabcdef");

  assert.equal(sent[0]!.method, "DELETE");
  assert.equal(sent[0]!.url, "https://overview.example/api/shares/k7Qm2x9RfTabcdef");
});

test("stopping a link that is already off is not an error, because it is what was asked for", async () => {
  const { fetch } = answering(404, { error: { code: "not_found", message: "no live link" } });
  const api = createFetchShareApi({ baseUrl: "https://overview.example", fetch });

  await api.stop("k7Qm2x9RfTabcdef");
});
