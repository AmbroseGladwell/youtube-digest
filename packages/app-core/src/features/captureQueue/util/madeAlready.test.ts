import { describe, expect, it } from "vitest";
import { DEFAULT_OVERVIEW_STATE, VideoId } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { madeAlready } from "./madeAlready.js";

const queued = (videoId: string) => makeQueuedCapture({ videoId: VideoId.parse(videoId) });

const made = (videoId: string): LibraryEntry => {
  const overview = makeOverview({ source: { ...makeOverview().source, id: VideoId.parse(videoId) } });
  return { kind: "overview", overview, state: { ...DEFAULT_OVERVIEW_STATE, overviewId: overview.id } };
};

describe("madeAlready", () => {
  it("names the queued videos the library already holds", () => {
    expect(madeAlready([queued("video000001"), queued("video000002")], [made("video000002"), made("video000003")])).toEqual(
      new Set(["video000002"]),
    );
  });

  it("names nothing while the library is empty", () => {
    expect(madeAlready([queued("video000001")], []).size).toBe(0);
  });
});
