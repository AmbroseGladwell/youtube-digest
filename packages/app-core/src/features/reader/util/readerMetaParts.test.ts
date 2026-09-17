import { describe, expect, it } from "vitest";
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

describe("readerMetaParts", () => {
  it("reads the design's line when the source carries a duration", () => {
    expect(readerMetaParts(timing, 698_000)).toEqual(["3 min read", "4 min listen", "11:38 video"]);
  });

  it("drops the video term rather than inventing one when no duration was stored", () => {
    expect(readerMetaParts(timing, null)).toEqual(["3 min read", "4 min listen"]);
  });
});
