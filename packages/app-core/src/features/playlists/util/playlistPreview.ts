import type { PlaylistLookup, PlaylistOrder } from "@overview/domain";
import { inPlaylistOrder, placedEntries, type PlacedPlaylistEntry } from "./inPlaylistOrder.js";
import { tokenEstimate } from "./tokenEstimate.js";

export interface PlaylistPreview {
  total: number;
  inLibrary: number;
  unavailable: number;
  toMake: PlacedPlaylistEntry[];
  tokens: number;
}

// What following a playlist with its backfill would do, counted from the lookup itself
// (docs/features/playlists.md, "The preview").
export function playlistPreview(lookup: PlaylistLookup, held: ReadonlySet<string>, order: PlaylistOrder): PlaylistPreview {
  const entries = placedEntries(lookup.entries);
  const inLibrary = entries.filter((entry) => held.has(entry.videoId)).length;
  const fresh = entries.filter((entry) => !held.has(entry.videoId));
  const toMake = inPlaylistOrder(
    fresh.filter((entry) => entry.availability === "available"),
    order,
  );
  return {
    total: lookup.entries.length,
    inLibrary,
    unavailable: fresh.length - toMake.length,
    toMake,
    tokens: tokenEstimate(toMake.length),
  };
}
