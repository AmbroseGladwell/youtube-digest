import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId } from "@overview/domain";
import { makeFollowedPlaylist } from "../types/PlaylistFactory.testHelper.js";
import { checkedAgo, followedPlaylistMeta, followingRowValue, unavailableLine } from "./followedPlaylistLines.js";

const check = (videos: number) => ({
  playlistId: PlaylistId.parse("PLpsychology"),
  seenVideoIds: Array.from({ length: videos }, (_, index) => VideoId.parse(`v${index}`)),
  checkedAt: "2026-10-05T09:00:00.000Z",
});

describe("followedPlaylistLines", () => {
  it("says who owns it, how it's shared, how many videos and overviews it has", () => {
    expect(followedPlaylistMeta(makeFollowedPlaylist(), check(23), 11)).toBe("Veritasium · Public · 23 videos · 11 overviews");
    expect(followedPlaylistMeta(makeFollowedPlaylist({ privacy: "unlisted", owner: null }), check(1), 1)).toBe(
      "Unlisted · 1 video · 1 overview",
    );
  });

  it("leaves the video count out where this device has never checked the playlist", () => {
    expect(followedPlaylistMeta(makeFollowedPlaylist(), null, 0)).toBe("Veritasium · Public · 0 overviews");
  });

  it("says when it was last checked", () => {
    const now = new Date("2026-10-05T09:04:30.000Z");
    expect(checkedAgo("2026-10-05T09:00:00.000Z", now)).toBe("Checked 4 minutes ago");
    expect(checkedAgo("2026-10-05T09:04:00.000Z", now)).toBe("Checked just now");
  });

  it("says why a playlist can no longer be checked", () => {
    expect(unavailableLine(makeFollowedPlaylist({ unavailable: "private" }))).toBe(
      "Now private on YouTube, so we can’t check it for new videos.",
    );
    expect(unavailableLine(makeFollowedPlaylist())).toBeNull();
  });

  it("summarises the section on its Settings row", () => {
    expect(followingRowValue(0)).toBe("None");
    expect(followingRowValue(3)).toBe("Following 3");
  });
});
