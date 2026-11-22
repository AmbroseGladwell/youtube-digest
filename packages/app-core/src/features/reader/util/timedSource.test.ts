import { describe, expect, it } from "vitest";
import { VideoId } from "@overview/domain";
import {
  makeArticleOverview,
  makeOverview,
  makePodcastOverview,
  makeTikTokOverview,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { machineTranscribedLabel, playingLabel, timedSource } from "./timedSource.js";

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

  it("reads a TikTok by its source key, as its transcript is stored, named for its creator", () => {
    expect(timedSource(makeTikTokOverview().source)).toMatchObject({
      id: "tiktok:7301234567890123456",
      url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
      channel: "Kitchen with Ada",
      durationMs: 42_000,
    });
  });

  it("gives a page no times", () => {
    expect(timedSource(makeArticleOverview().source)).toBeNull();
  });
});

describe("labels", () => {
  it("says a TikTok plays on TikTok", () => {
    expect(playingLabel({ id: VideoId.parse("tiktok:7301234567890123456") })).toBe("Playing on TikTok");
  });

  it("names YouTube's own words for a video", () => {
    expect(playingLabel({ id: VideoId.parse("dQw4w9WgXcQ") })).toBe("Playing on YouTube");
    expect(machineTranscribedLabel("video")).toBe("Auto-generated");
  });

  it("borrows none of YouTube's words for an episode, which plays in the page", () => {
    expect(playingLabel({ id: VideoId.parse("podcast:fedcba9876543210fedcba9876543210") })).toBe("Playing");
    expect(machineTranscribedLabel("episode")).toBe("Machine-transcribed");
  });
});
