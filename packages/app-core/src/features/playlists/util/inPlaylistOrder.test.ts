import { describe, expect, it } from "vitest";
import { makePlaylistEntry } from "../types/PlaylistFactory.testHelper.js";
import { inPlaylistOrder, placedEntries } from "./inPlaylistOrder.js";

const entries = placedEntries([
  makePlaylistEntry("b", { addedAt: "2026-09-02T09:00:00.000Z" }),
  makePlaylistEntry("c", { addedAt: "2026-09-03T09:00:00.000Z" }),
  makePlaylistEntry("a", { addedAt: "2026-09-01T09:00:00.000Z" }),
]);

const idsIn = (order: Parameters<typeof inPlaylistOrder>[1]) => inPlaylistOrder(entries, order).map((entry) => entry.videoId);

describe("inPlaylistOrder", () => {
  it("puts the one added longest ago first", () => {
    expect(idsIn("oldestFirst")).toEqual(["a", "b", "c"]);
  });

  it("newest first is oldest first turned round", () => {
    expect(idsIn("newestFirst")).toEqual(["c", "b", "a"]);
  });

  it("the playlist's own order is the order it was read in", () => {
    expect(idsIn("playlistOrder")).toEqual(["b", "c", "a"]);
  });

  it("the playlist's own order decides where YouTube gives no date", () => {
    const undated = placedEntries([makePlaylistEntry("b", { addedAt: null }), makePlaylistEntry("a", { addedAt: null })]);

    expect(inPlaylistOrder(undated, "oldestFirst").map((entry) => entry.videoId)).toEqual(["b", "a"]);
    expect(inPlaylistOrder(undated, "newestFirst").map((entry) => entry.videoId)).toEqual(["a", "b"]);
  });

  it("videos added at the same moment keep the playlist's order, turned round for newest first", () => {
    const together = placedEntries([
      makePlaylistEntry("b", { addedAt: "2026-09-02T09:00:00.000Z" }),
      makePlaylistEntry("a", { addedAt: "2026-09-02T09:00:00.000Z" }),
    ]);

    expect(inPlaylistOrder(together, "oldestFirst").map((entry) => entry.videoId)).toEqual(["b", "a"]);
    expect(inPlaylistOrder(together, "newestFirst").map((entry) => entry.videoId)).toEqual(["a", "b"]);
  });

  it("a video with no place of its own keeps the one it arrived with", () => {
    const places = [
      { addedAt: null, playlistIndex: null, id: "first" },
      { addedAt: null, playlistIndex: null, id: "second" },
    ];

    expect(inPlaylistOrder(places, "playlistOrder").map(({ id }) => id)).toEqual(["first", "second"]);
  });
});
