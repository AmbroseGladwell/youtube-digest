import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId, type PlaylistPace } from "@overview/domain";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { chosenBarLine, madeNowNotice, makeChosenLabel } from "./chooseCopy.js";

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
