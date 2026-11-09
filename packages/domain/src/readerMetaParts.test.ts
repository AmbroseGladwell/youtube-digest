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
  assert.deepEqual(readerMetaParts(timing, "11:38 video"), ["3 min read", "4 min listen", "11:38 video"]);
});

test("a video with no stored duration still names its kind", () => {
  assert.deepEqual(readerMetaParts(timing, "Video"), ["3 min read", "4 min listen", "Video"]);
});

test("an article names its own length", () => {
  assert.deepEqual(readerMetaParts(timing, "14 min article"), ["3 min read", "4 min listen", "14 min article"]);
});
