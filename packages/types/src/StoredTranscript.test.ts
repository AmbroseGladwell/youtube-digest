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
