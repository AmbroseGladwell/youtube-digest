import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { madeTodayByPlaylist, nextLocalMidnight } from "./madeTodayByPlaylist.js";

const PSYCHOLOGY = { id: PlaylistId.parse("PLpsychology"), title: "Psychology" };
const NOW = new Date(2026, 9, 26, 15, 0);
const localIso = (hour: number, day = 26) => new Date(2026, 9, day, hour, 30).toISOString();

const fromPsychology = (videoId: string, savedAt: string) =>
  makeOverview({
    savedAt,
    fromPlaylist: PSYCHOLOGY,
    video: { ...makeOverview().video, id: VideoId.parse(videoId) },
  });

describe("madeTodayByPlaylist", () => {
  it("counts each playlist's overviews made since local midnight", () => {
    const counts = madeTodayByPlaylist(
      [fromPsychology("video000001", localIso(0)), fromPsychology("video000002", localIso(14)), fromPsychology("video000003", localIso(23, 25))],
      new Set(),
      NOW,
    );

    expect(counts.get(PSYCHOLOGY.id)).toBe(2);
  });

  it("never counts an overview made by hand, which has no playlist", () => {
    expect(madeTodayByPlaylist([makeOverview({ savedAt: localIso(10) })], new Set(), NOW).size).toBe(0);
  });

  it("leaves out a video the reader chose to make now", () => {
    const counts = madeTodayByPlaylist(
      [fromPsychology("video000001", localIso(9)), fromPsychology("video000002", localIso(10))],
      new Set(["video000002"]),
      NOW,
    );

    expect(counts.get(PSYCHOLOGY.id)).toBe(1);
  });
});

describe("nextLocalMidnight", () => {
  it("is the start of the reader's next day", () => {
    expect(nextLocalMidnight(NOW)).toEqual(new Date(2026, 9, 27, 0, 0));
  });
});
