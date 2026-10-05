import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId } from "@overview/domain";
import { InMemoryCaptureQueueStore } from "../captureQueue/types/InMemoryCaptureQueueStore.testHelper.js";
import { InMemoryFollowedPlaylistStore } from "../playlists/types/InMemoryFollowedPlaylistStore.testHelper.js";
import { makeFollowedPlaylist, makeQueuedCapture } from "../playlists/types/PlaylistFactory.testHelper.js";
import { moveFollowingInto } from "./moveFollowingInto.js";

const library = () => ({
  followedPlaylistStore: new InMemoryFollowedPlaylistStore(),
  captureQueueStore: new InMemoryCaptureQueueStore(),
});

describe("moveFollowingInto", () => {
  it("brings followed playlists, what this device had seen of them, and its queue into the account", async () => {
    const from = library();
    const into = library();
    const playlist = makeFollowedPlaylist();
    from.followedPlaylistStore.seedFollowed(playlist);
    from.followedPlaylistStore.seedCheck({ playlistId: playlist.id, seenVideoIds: [VideoId.parse("a")], checkedAt: playlist.followedAt });
    await from.captureQueueStore.enqueue([makeQueuedCapture({ videoId: VideoId.parse("b") })]);

    const move = await moveFollowingInto(from, into);

    expect(move).toEqual({ playlists: 1 });
    expect(await into.followedPlaylistStore.listFollowed()).toEqual([playlist]);
    expect((await into.followedPlaylistStore.getCheck(playlist.id))?.seenVideoIds).toEqual(["a"]);
    expect((await into.captureQueueStore.listQueue()).map((capture) => capture.videoId)).toEqual(["b"]);
    expect(await from.followedPlaylistStore.listFollowed()).toEqual([]);
    expect(await from.captureQueueStore.listQueue()).toEqual([]);
  });

  it("keeps the account's own record of a playlist it already follows", async () => {
    const from = library();
    const into = library();
    const accountCopy = makeFollowedPlaylist({ title: "Psychology (account)" });
    into.followedPlaylistStore.seedFollowed(accountCopy);
    from.followedPlaylistStore.seedFollowed(makeFollowedPlaylist({ id: PlaylistId.parse(accountCopy.id) }));

    const move = await moveFollowingInto(from, into);

    expect(move).toEqual({ playlists: 0 });
    expect(await into.followedPlaylistStore.listFollowed()).toEqual([accountCopy]);
  });
});
