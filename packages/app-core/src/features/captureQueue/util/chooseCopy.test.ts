import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId, type PlaylistPace } from "@overview/domain";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { chosenBarLine, madeNowNotice, madeNowOf, makeChosenLabel } from "./chooseCopy.js";

const psychology = (videoId: string, title = "How Sleep Cleans the Brain") =>
  makeQueuedCapture({ videoId: VideoId.parse(videoId), title, fromPlaylist: { id: PlaylistId.parse("PLpsychology"), title: "Psychology" } });
const saved = (videoId: string) =>
  makeQueuedCapture({ videoId: VideoId.parse(videoId), fromPlaylist: { id: PlaylistId.parse("PLsaved"), title: "Saved for later" } });
const paces: Record<string, PlaylistPace> = { PLpsychology: "fiveADay", PLsaved: "whenChosen" };
const paceOf = (playlistId: string) => paces[playlistId] ?? "asTheyCome";

describe("chooseCopy", () => {
  it("says the playlist's pace stays as it is, as design 95ag does", () => {
    expect(chosenBarLine([psychology("video000001"), psychology("video000002")], paceOf)).toBe(
      "Made next, oldest first. Psychology stays at up to 5 a day.",
    );
  });

  it("with more chosen than the month has left, says how many are made now and when the rest go, as 95ah does", () => {
    const seven = ["01", "02", "03", "04", "05", "06", "07"].map((n) => psychology(`video0000${n}`.padEnd(11, "0")));
    const allowance = { left: 4, resetsOn: "2026-11-01" };
    expect(chosenBarLine(seven, paceOf, allowance)).toBe(
      "You have 4 left this month, so 4 are made now and the other 3 wait for 1 November. Psychology stays at up to 5 a day.",
    );
    expect(madeNowOf(7, allowance)).toBe(4);
    expect(madeNowOf(3, allowance)).toBe(3);
    expect(chosenBarLine(seven.slice(0, 3), paceOf, allowance)).toBe("Made next, oldest first. Psychology stays at up to 5 a day.");
  });

  it("from several playlists, says every pace stays", () => {
    expect(chosenBarLine([psychology("video000001"), saved("video000002")], paceOf)).toBe("Made next, oldest first. Paces stay as they are.");
  });

  it("from a playlist made only when chosen, says the rest keep waiting for the reader", () => {
    expect(chosenBarLine([saved("video000001")], paceOf)).toBe("Made next, oldest first. The rest of Saved for later keep waiting for you.");
  });

  it("names the one video made next, or counts several", () => {
    expect(madeNowNotice([psychology("video000001")], paceOf)).toEqual({
      lead: "Making “How Sleep Cleans the Brain” next.",
      rest: "Psychology stays at up to 5 a day.",
    });
    expect(madeNowNotice([psychology("video000001"), psychology("video000002")], paceOf).lead).toBe("Making 2 next.");
  });

  it("labels the button by what it makes", () => {
    expect(makeChosenLabel(1)).toBe("Make it now");
    expect(makeChosenLabel(3)).toBe("Make 3 now");
  });
});
