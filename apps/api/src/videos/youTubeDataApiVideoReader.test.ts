import test from "node:test";
import assert from "node:assert/strict";
import type { VideoId } from "@overview/domain";
import type { YouTubeFetch, YouTubeFetchRequest } from "@overview/transcripts";
import { youTubeDataApiVideoReader } from "./youTubeDataApiVideoReader.js";

const VIDEO_ID = "dQw4w9WgXcQ" as VideoId;
const LONG_DESCRIPTION = "A chef shows the claw grip. ".repeat(40);

const answering = (status: number, body: unknown) => {
  const requests: YouTubeFetchRequest[] = [];
  const youTubeFetch: YouTubeFetch = async (request) => {
    requests.push(request);
    return { status, body: JSON.stringify(body) };
  };
  return { requests, read: youTubeDataApiVideoReader({ apiKey: "test-key", youTubeFetch }) };
};

const ITEM = {
  id: VIDEO_ID,
  snippet: {
    title: "Knife Skills in Ten Minutes",
    channelTitle: "Kitchen Basics",
    description: LONG_DESCRIPTION,
    publishedAt: "2026-10-01T12:00:00Z",
    thumbnails: { default: { url: "https://i.ytimg.com/vi/x/default.jpg" }, high: { url: "https://i.ytimg.com/vi/x/hq.jpg" } },
  },
  contentDetails: { duration: "PT12M5S" },
};

test("a video comes back as the card needs it, from one call with the key in a header", async () => {
  const { requests, read } = answering(200, { items: [ITEM] });

  const answer = await read(VIDEO_ID);

  assert.ok(answer !== null);
  assert.equal(answer.title, "Knife Skills in Ten Minutes");
  assert.equal(answer.channel, "Kitchen Basics");
  assert.equal(answer.durationMs, 725_000);
  assert.equal(answer.thumbnailUrl, "https://i.ytimg.com/vi/x/hq.jpg");
  assert.equal(answer.description?.length, 400);
  assert.equal(answer.publishedAt, "2026-10-01T12:00:00.000Z");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.headers["x-goog-api-key"], "test-key");
  assert.ok(!requests[0]!.url.includes("test-key"));
});

test("a video YouTube doesn't list is not found", async () => {
  const { read } = answering(200, { items: [] });

  assert.equal(await read(VIDEO_ID), null);
});

test("a live video with no length and no description still reads", async () => {
  const { read } = answering(200, {
    items: [{ ...ITEM, snippet: { title: "Live now", channelTitle: "Kitchen Basics" }, contentDetails: { duration: "P0D" } }],
  });

  const answer = await read(VIDEO_ID);

  assert.ok(answer !== null);
  assert.equal(answer.durationMs, null);
  assert.equal(answer.description, null);
  assert.equal(answer.thumbnailUrl, null);
});
