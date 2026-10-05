import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId } from "@overview/domain";
import { makeFollowedPlaylist, makePlaylistEntry, makePlaylistLookup } from "../types/PlaylistFactory.testHelper.js";
import { newPlaylistEntries } from "./newPlaylistEntries.js";

const playlist = makeFollowedPlaylist({ followedAt: "2026-10-01T09:00:00.000Z" });
const check = (seen: string[]) => ({
  playlistId: PlaylistId.parse(playlist.id),
  seenVideoIds: seen.map((id) => VideoId.parse(id)),
  checkedAt: "2026-10-02T09:00:00.000Z",
});
const ids = (result: ReturnType<typeof newPlaylistEntries>) => result.fresh.map((entry) => entry.videoId);

describe("newPlaylistEntries", () => {
  it("queues only what this device hasn't seen in the playlist before", () => {
    const lookup = makePlaylistLookup({ entries: [makePlaylistEntry("old"), makePlaylistEntry("added")] });

    const result = newPlaylistEntries(lookup, playlist, check(["old"]), new Set());

    expect(ids(result)).toEqual(["added"]);
    expect(result.seen).toEqual(["old", "added"]);
  });

  it("a playlist reordered by hand queues nothing again", () => {
    const lookup = makePlaylistLookup({ entries: [makePlaylistEntry("b"), makePlaylistEntry("a")] });
    expect(ids(newPlaylistEntries(lookup, playlist, check(["a", "b"]), new Set()))).toEqual([]);
  });

  it("skips a video already made or already waiting", () => {
    const lookup = makePlaylistLookup({ entries: [makePlaylistEntry("made"), makePlaylistEntry("queued"), makePlaylistEntry("new")] });
    expect(ids(newPlaylistEntries(lookup, playlist, check([]), new Set(["made", "queued"])))).toEqual(["new"]);
  });

  it("on a device that has never checked the playlist, queues what was added after it was followed", () => {
    const lookup = makePlaylistLookup({
      entries: [
        makePlaylistEntry("before", { addedAt: "2026-09-30T09:00:00.000Z" }),
        makePlaylistEntry("after", { addedAt: "2026-10-03T09:00:00.000Z" }),
        makePlaylistEntry("undated", { addedAt: null }),
      ],
    });
    expect(ids(newPlaylistEntries(lookup, playlist, null, new Set()))).toEqual(["after"]);
  });
});
