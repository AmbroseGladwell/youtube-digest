import { VideoId } from "@overview/types";
import { describe, expect, it } from "vitest";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { overviewForVideoUrl } from "./overviewForVideoUrl.js";

const noteOn = (videoId: string | null, savedAt = "2026-09-16T00:00:00.000Z") => {
  const entry = makeOverviewWithState({ savedAt });
  return {
    ...entry,
    overview: {
      ...entry.overview,
      video: { ...entry.overview.video, id: videoId === null ? null : VideoId.parse(videoId) },
    },
  };
};

describe("overviewForVideoUrl", () => {
  it("finds nothing when the panel is not on a video", () => {
    expect(overviewForVideoUrl([noteOn("abc")], null)).toBeNull();
  });

  it("finds nothing when the library is empty", () => {
    expect(overviewForVideoUrl([], "https://www.youtube.com/watch?v=abc")).toBeNull();
  });

  it("finds the note taken from that video", () => {
    const held = noteOn("abc");

    expect(
      overviewForVideoUrl([noteOn("other"), held], "https://www.youtube.com/watch?v=abc"),
    ).toBe(held.overview);
  });

  // The stored url is whichever one was pasted, so two spellings of the same video have
  // to resolve to the same note (docs/features/transcript-storage.md).
  it("matches the video rather than the spelling of its link", () => {
    const held = noteOn("abc");

    expect(overviewForVideoUrl([held], "https://youtu.be/abc")).toBe(held.overview);
    expect(overviewForVideoUrl([held], "https://www.youtube.com/watch?v=abc&t=30")).toBe(
      held.overview,
    );
    expect(overviewForVideoUrl([held], "https://www.youtube.com/shorts/abc")).toBe(held.overview);
  });

  it("offers the newest note when a video has been written up more than once", () => {
    const older = noteOn("abc", "2026-09-15T00:00:00.000Z");
    const newer = noteOn("abc", "2026-09-17T00:00:00.000Z");

    expect(overviewForVideoUrl([older, newer], "https://www.youtube.com/watch?v=abc")).toBe(
      newer.overview,
    );
  });

  it("finds nothing for a link that isn't a YouTube video", () => {
    expect(overviewForVideoUrl([noteOn("abc")], "https://example.com/abc")).toBeNull();
  });

  // A note saved before transcripts were keyed by video has no id to match on, and must
  // not be matched by the absence of one.
  it("never matches a note that has no video id", () => {
    expect(overviewForVideoUrl([noteOn(null)], "https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});
