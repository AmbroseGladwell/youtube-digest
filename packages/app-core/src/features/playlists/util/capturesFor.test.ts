import { describe, expect, it } from "vitest";
import { PlaylistId } from "@overview/domain";
import { makePlaylistEntry } from "../types/PlaylistFactory.testHelper.js";
import { capturesFor } from "./capturesFor.js";

const origin = { id: PlaylistId.parse("PLpsychology"), title: "Psychology" };

describe("capturesFor", () => {
  it("queues each video oldest first, a millisecond apart so the order holds", () => {
    const captures = capturesFor(
      [makePlaylistEntry("b", { addedAt: "2026-09-02T09:00:00.000Z" }), makePlaylistEntry("a", { addedAt: "2026-09-01T09:00:00.000Z" })],
      origin,
      new Date("2026-10-05T09:00:00.000Z"),
    );

    expect(captures.map(({ videoId, queuedAt }) => [videoId, queuedAt])).toEqual([
      ["a", "2026-10-05T09:00:00.000Z"],
      ["b", "2026-10-05T09:00:00.001Z"],
    ]);
    expect(captures[0]).toMatchObject({ url: "https://www.youtube.com/watch?v=a", status: "waiting", problem: null, fromPlaylist: origin });
  });

  it("a private or deleted video is queued as skipped, saying why", () => {
    const [privateOne, deleted] = capturesFor(
      [makePlaylistEntry("p", { availability: "private" }), makePlaylistEntry("d", { availability: "deleted" })],
      origin,
      new Date(),
    );
    expect(privateOne).toMatchObject({ status: "skipped", problem: "private" });
    expect(deleted).toMatchObject({ status: "skipped", problem: "deleted" });
  });
});
