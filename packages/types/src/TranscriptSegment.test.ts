import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptSegment } from "./TranscriptSegment.js";

test("a transcript segment is text plus a millisecond start and end", () => {
  assert.doesNotThrow(() => TranscriptSegment.parse({ text: "Hello.", startMs: 0, endMs: 2000 }));
});

test("negative timings are rejected", () => {
  assert.throws(() => TranscriptSegment.parse({ text: "Hello.", startMs: -1, endMs: 2000 }));
});
