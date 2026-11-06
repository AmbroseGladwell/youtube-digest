import { describe, expect, it } from "vitest";
import { PlaylistId } from "@overview/domain";
import { makePlaylistEntry } from "../types/PlaylistFactory.testHelper.js";
import { placedEntries } from "./inPlaylistOrder.js";
import { capturesFor } from "./capturesFor.js";

const origin = { id: PlaylistId.parse("PLpsychology"), title: "Psychology" };

describe("capturesFor", () => {
  it("queues each video a millisecond apart, keeping where it sat in its playlist", () => {
    const captures = capturesFor(
      placedEntries([
        makePlaylistEntry("b", { addedAt: "2026-09-02T09:00:00.000Z" }),
        makePlaylistEntry("a", { addedAt: "2026-09-01T09:00:00.000Z" }),
      ]),
      origin,
      new Date("2026-10-05T09:00:00.000Z"),
    );

    expect(captures.map(({ videoId, queuedAt, playlistIndex }) => [videoId, queuedAt, playlistIndex])).toEqual([
      ["b", "2026-10-05T09:00:00.000Z", 0],
      ["a", "2026-10-05T09:00:00.001Z", 1],
    ]);
    expect(captures[0]).toMatchObject({
      url: "https://www.youtube.com/watch?v=b",
      status: "waiting",
      problem: null,
      fromPlaylist: origin,
      addedAt: "2026-09-02T09:00:00.000Z",
    });
  });

  it("a private or deleted video is queued as skipped, saying why", () => {
    const [privateOne, deleted] = capturesFor(
      placedEntries([makePlaylistEntry("p", { availability: "private" }), makePlaylistEntry("d", { availability: "deleted" })]),
      origin,
      new Date(),
    );
    expect(privateOne).toMatchObject({ status: "skipped", problem: "private" });
    expect(deleted).toMatchObject({ status: "skipped", problem: "deleted" });
  });
});
