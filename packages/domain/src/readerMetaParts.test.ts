import test from "node:test";
import assert from "node:assert/strict";
import { noteTiming } from "./noteTiming.js";
import { readerMetaParts } from "./readerMetaParts.js";

const timing = noteTiming([
  {
    section: "Summary",
    heading: false,
    bullet: false,
    text: Array.from({ length: 660 }, () => "word").join(" "),
  },
]);

test("the design's line reads whole when the source carries a duration", () => {
  assert.deepEqual(readerMetaParts(timing, 698_000), ["3 min read", "4 min listen", "11:38 video"]);
});

test("the video term is dropped rather than invented when no duration was stored", () => {
  assert.deepEqual(readerMetaParts(timing, null), ["3 min read", "4 min listen"]);
});

test("an absent duration drops it too, rather than printing NaN:NaN video", () => {
  assert.deepEqual(readerMetaParts(timing, undefined), ["3 min read", "4 min listen"]);
});
