import test from "node:test";
import assert from "node:assert/strict";
import type { TikTokRead } from "@overview/domain";
import { createFetchTikTokApi } from "./fetchTikTokApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const read: TikTokRead = {
  status: "read",
  video: {
    id: "7301234567890123456",
    url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
    handle: "kitchenwithada",
    authorName: "Kitchen with Ada",
    description: "Sunday jollof",
    durationSeconds: 42,
    coverUrl: null,
    postedAt: null,
    captions: [{ language: "eng-US", source: "ASR" }],
  },
  transcript: {
    videoId: "tiktok:7301234567890123456" as never,
    segments: [{ text: "Fry the base.", startMs: 0, endMs: 1500 }],
    generated: true,
    fetchedAt: "2026-11-22T09:00:00.000Z",
  },
};

test("a TikTok link is read with its words in one call", async () => {
  const { sent, fetch } = answering(200, read);
  const api = createFetchTikTokApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });

  assert.deepEqual(await api.read("https://vm.tiktok.com/ZMhAbCdEf/"), read);
  assert.deepEqual(sent, [{ url: "https://overview.example/api/tiktok/read", body: { url: "https://vm.tiktok.com/ZMhAbCdEf/" } }]);
});

test("a read that failed comes back as the failure, and a server that doesn't read TikTok rejects", async () => {
  const failed = answering(200, { status: "failed", reason: "unavailable" });
  assert.deepEqual(await createFetchTikTokApi({ baseUrl: "https://overview.example", fetch: failed.fetch }).read("x"), {
    status: "failed",
    reason: "unavailable",
  });
  const off = answering(503, { error: { code: "unavailable", message: "This server does not read TikTok links" } });
  await assert.rejects(createFetchTikTokApi({ baseUrl: "https://overview.example", fetch: off.fetch }).read("x"), (error) => {
    assert.ok(isSyncRequestError(error));
    return true;
  });
});
