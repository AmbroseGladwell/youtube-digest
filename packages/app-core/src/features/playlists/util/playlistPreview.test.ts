import { describe, expect, it } from "vitest";
import { makePlaylistEntry, makePlaylistLookup } from "../types/PlaylistFactory.testHelper.js";
import { playlistPreview } from "./playlistPreview.js";
import { tokensText } from "./tokenEstimate.js";

describe("playlistPreview", () => {
  it("counts the playlist, what the library already has, and what is left to make, in the order it will be made in", () => {
    const lookup = makePlaylistLookup({
      entries: [
        makePlaylistEntry("newest", { addedAt: "2026-09-03T09:00:00.000Z" }),
        makePlaylistEntry("held", { addedAt: "2026-09-02T09:00:00.000Z" }),
        makePlaylistEntry("oldest", { addedAt: "2026-09-01T09:00:00.000Z" }),
      ],
    });

    const preview = playlistPreview(lookup, new Set(["held"]), "oldestFirst");

    expect(preview).toMatchObject({ total: 3, inLibrary: 1, unavailable: 0, tokens: 60_000 });
    expect(preview.toMake.map((entry) => entry.videoId)).toEqual(["oldest", "newest"]);
    expect(playlistPreview(lookup, new Set(["held"]), "newestFirst").toMake.map((entry) => entry.videoId)).toEqual([
      "newest",
      "oldest",
    ]);
  });

  it("leaves private and deleted videos out of what will be made, and counts them", () => {
    const lookup = makePlaylistLookup({
      entries: [makePlaylistEntry("a"), makePlaylistEntry("b", { availability: "private" }), makePlaylistEntry("c", { availability: "deleted" })],
    });

    expect(playlistPreview(lookup, new Set(), "oldestFirst")).toMatchObject({ total: 3, unavailable: 2, tokens: 30_000 });
  });

  it("an empty playlist has nothing to make and costs nothing", () => {
    expect(playlistPreview(makePlaylistLookup(), new Set(), "oldestFirst")).toMatchObject({ total: 0, toMake: [], tokens: 0 });
  });
});

describe("tokensText", () => {
  it("writes a figure under a million in full, and rounds a larger one to millions", () => {
    expect(tokensText(690_000)).toBe("690,000");
    expect(tokensText(6_240_000)).toBe("6.2 million");
    expect(tokensText(6_000_000)).toBe("6 million");
  });
});
