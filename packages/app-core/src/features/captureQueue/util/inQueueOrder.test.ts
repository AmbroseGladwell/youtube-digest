import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId, type PlaylistOrder } from "@overview/domain";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { inQueueOrder } from "./inQueueOrder.js";

const psychology = { id: PlaylistId.parse("PLpsychology"), title: "Psychology" };
const lectures = { id: PlaylistId.parse("PLlectures"), title: "Every Lecture" };

const queued = (videoId: string, fromPlaylist: typeof psychology, addedAt: string, playlistIndex: number) =>
  makeQueuedCapture({ videoId: VideoId.parse(videoId), fromPlaylist, addedAt, playlistIndex });

const waiting = [
  queued("a", psychology, "2026-09-01T09:00:00.000Z", 0),
  queued("x", lectures, "2026-09-05T09:00:00.000Z", 0),
  queued("b", psychology, "2026-09-02T09:00:00.000Z", 1),
  queued("c", psychology, "2026-09-03T09:00:00.000Z", 2),
  queued("y", lectures, "2026-09-06T09:00:00.000Z", 1),
];

const idsAt = (order: PlaylistOrder) => inQueueOrder(waiting, () => order).map((capture) => capture.videoId);

describe("inQueueOrder", () => {
  it("leaves a queue already in its playlists' order alone", () => {
    expect(idsAt("oldestFirst")).toEqual(["a", "x", "b", "c", "y"]);
  });

  it("turns a playlist round in the places it already holds, leaving the others where they were", () => {
    expect(idsAt("newestFirst")).toEqual(["c", "y", "b", "a", "x"]);
  });

  it("each playlist follows its own order", () => {
    const ids = inQueueOrder(waiting, (playlistId) => (playlistId === psychology.id ? "newestFirst" : "oldestFirst")).map(
      (capture) => capture.videoId,
    );

    expect(ids).toEqual(["c", "x", "b", "a", "y"]);
  });

  it("a video queued before there was an order to keep stays where it is", () => {
    const earlier = [
      makeQueuedCapture({ videoId: VideoId.parse("one"), addedAt: null, playlistIndex: null }),
      makeQueuedCapture({ videoId: VideoId.parse("two"), addedAt: null, playlistIndex: null }),
    ];

    expect(inQueueOrder(earlier, () => "newestFirst").map((capture) => capture.videoId)).toEqual(["two", "one"]);
    expect(inQueueOrder(earlier, () => "playlistOrder").map((capture) => capture.videoId)).toEqual(["one", "two"]);
  });
});
