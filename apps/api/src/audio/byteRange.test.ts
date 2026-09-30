import test from "node:test";
import assert from "node:assert/strict";
import { byteRange } from "./byteRange.js";

test("no Range header, or one it cannot read, means the whole file", () => {
  assert.equal(byteRange(undefined, 1000), null);
  assert.equal(byteRange("bytes=0-10,20-30", 1000), null);
  assert.equal(byteRange("items=0-10", 1000), null);
  assert.equal(byteRange("bytes=-", 1000), null);
});

test("Safari's opening probe of the first two bytes is answered with exactly those", () => {
  assert.deepEqual(byteRange("bytes=0-1", 1000), { start: 0, end: 1 });
});

test("an open-ended range runs to the last byte", () => {
  assert.deepEqual(byteRange("bytes=500-", 1000), { start: 500, end: 999 });
});

test("a suffix range is the last n bytes, or the whole file when n is larger", () => {
  assert.deepEqual(byteRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(byteRange("bytes=-5000", 1000), { start: 0, end: 999 });
});

test("an end past the file is cut to the file", () => {
  assert.deepEqual(byteRange("bytes=900-5000", 1000), { start: 900, end: 999 });
});

test("a range that starts past the end, runs backwards or asks for nothing is unsatisfiable", () => {
  assert.equal(byteRange("bytes=1000-", 1000), "unsatisfiable");
  assert.equal(byteRange("bytes=20-10", 1000), "unsatisfiable");
  assert.equal(byteRange("bytes=-0", 1000), "unsatisfiable");
});
