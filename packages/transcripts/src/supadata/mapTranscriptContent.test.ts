import test from "node:test";
import assert from "node:assert/strict";
import { mapTranscriptContent } from "./mapTranscriptContent.js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";

test("offset/duration chunks map to startMs/endMs segments", () => {
  const segments = mapTranscriptContent([
    { text: "Hello.", offset: 0, duration: 2000, lang: "en" },
    { text: "World.", offset: 2000, duration: 1500, lang: "en" },
  ]);
  assert.deepEqual(segments, [
    { text: "Hello.", startMs: 0, endMs: 2000 },
    { text: "World.", startMs: 2000, endMs: 3500 },
  ]);
});

test("a plain-text response (text: true was requested by mistake) is a clear error, not silently wrong segments", () => {
  assert.throws(() => mapTranscriptContent("Hello. World."), TranscriptFetchError);
});
