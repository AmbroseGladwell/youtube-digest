import test from "node:test";
import assert from "node:assert/strict";
import { StoredTranscript } from "./StoredTranscript.js";

const baseTranscript = {
  videoId: "tL9Lw250spc",
  segments: [{ text: "Hello.", startMs: 0, endMs: 2000 }],
  generated: false,
  fetchedAt: new Date().toISOString(),
};

test("a stored transcript is a video id, its timed segments, and when they were fetched", () => {
  assert.doesNotThrow(() => StoredTranscript.parse(baseTranscript));
});

test("a video with no captions at all still stores, as an empty segment list", () => {
  assert.doesNotThrow(() => StoredTranscript.parse({ ...baseTranscript, segments: [] }));
});

test("an empty video id is rejected, because it would key every transcript to the same row", () => {
  assert.throws(() => StoredTranscript.parse({ ...baseTranscript, videoId: "" }));
});

test("a record written before metadata was kept still parses, and simply holds no video", () => {
  assert.equal(StoredTranscript.parse(baseTranscript).video, undefined);
});

test("the metadata the captions were fetched with round-trips beside them", () => {
  const video = {
    id: "tL9Lw250spc",
    url: "https://www.youtube.com/watch?v=tL9Lw250spc",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: 180_000,
    publishedAt: null,
    thumbnailUrl: null,
  };
  assert.deepEqual(StoredTranscript.parse({ ...baseTranscript, video }).video, video);
});
