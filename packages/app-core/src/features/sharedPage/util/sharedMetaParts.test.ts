import { describe, expect, it } from "vitest";
import { shareSnapshot } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { sharedMetaParts } from "./sharedMetaParts.js";

const noteOf = (publishedAt: string | null, durationMs: number | null) =>
  shareSnapshot({
    overview: makeOverview({ video: { ...makeOverview().video, publishedAt, durationMs } }),
    transcript: null,
    narration: null,
  }).note;

describe("sharedMetaParts", () => {
  it("reads the design's line, ending with when the copy was made", () => {
    const parts = sharedMetaParts(noteOf("2026-09-04T00:00:00.000Z", 842_000), "2026-09-30T11:00:00.000Z");

    expect(parts).toEqual(["1 min read", "1 min listen", "14:02 video", "published 4 Sept 2026", "shared 30 Sept"]);
  });

  it("drops a publish date the copy does not carry rather than inventing one", () => {
    const parts = sharedMetaParts(noteOf(null, null), "2026-09-30T11:00:00.000Z");

    expect(parts).toEqual(["1 min read", "1 min listen", "shared 30 Sept"]);
  });
});
