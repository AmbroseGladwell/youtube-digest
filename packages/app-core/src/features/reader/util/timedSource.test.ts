import { describe, expect, it } from "vitest";
import { makeArticleOverview, makeOverview, makePodcastOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { timedSource } from "./timedSource.js";

describe("timedSource", () => {
  it("reads a video as it is", () => {
    const { source } = makeOverview();
    expect(timedSource(source)).toBe(source);
  });

  it("reads an episode by its source key, as its transcript is stored, pointing at the link the reader shared", () => {
    const timed = timedSource(makePodcastOverview().source);
    expect(timed).toMatchObject({
      id: "podcast:fedcba9876543210fedcba9876543210",
      url: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
      channel: "The Diary Of A CEO",
      durationMs: 6_948_000,
    });
  });

  it("gives a page no times", () => {
    expect(timedSource(makeArticleOverview().source)).toBeNull();
  });
});
