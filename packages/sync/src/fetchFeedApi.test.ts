import test from "node:test";
import assert from "node:assert/strict";
import type { FeedCheck } from "@overview/domain";
import { createFetchFeedApi } from "./fetchFeedApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const FEED = "https://blog.example/feed.xml";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

test("checking followed feeds sends their addresses and reads each answer", async () => {
  const answer: FeedCheck = { feeds: [{ feedUrl: FEED, read: { status: "failed", reason: "busy" } }] };
  const { sent, fetch } = answering(200, answer);
  const api = createFetchFeedApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });

  assert.deepEqual(await api.check([FEED]), answer);
  assert.deepEqual(sent, [{ url: "https://overview.example/api/feeds/check", body: { feedUrls: [FEED] } }]);
});

test("looking a link up sends the link, and a refusal rejects with its code", async () => {
  const { sent, fetch } = answering(429, { error: { code: "too_many_requests", message: "slow down" } });
  const api = createFetchFeedApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.lookUp("https://blog.example/"), (error) => isSyncRequestError(error) && error.code === "too_many_requests");
  assert.deepEqual(sent, [{ url: "https://overview.example/api/feeds/lookup", body: { url: "https://blog.example/" } }]);
});
