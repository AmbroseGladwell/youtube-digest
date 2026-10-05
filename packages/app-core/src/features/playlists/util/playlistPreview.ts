import type { PlaylistEntry, PlaylistLookup } from "@overview/domain";
import { oldestFirst } from "./oldestFirst.js";
import { tokenEstimate } from "./tokenEstimate.js";

export interface PlaylistPreview {
  total: number;
  inLibrary: number;
  unavailable: number;
  toMake: PlaylistEntry[];
  tokens: number;
}

// What following a playlist with its backfill would do, counted from the lookup itself
// (docs/features/playlists.md, "The preview").
export function playlistPreview(lookup: PlaylistLookup, held: ReadonlySet<string>): PlaylistPreview {
  const inLibrary = lookup.entries.filter((entry) => held.has(entry.videoId)).length;
  const fresh = lookup.entries.filter((entry) => !held.has(entry.videoId));
  const toMake = oldestFirst(fresh.filter((entry) => entry.availability === "available"));
  return {
    total: lookup.entries.length,
    inLibrary,
    unavailable: fresh.length - toMake.length,
    toMake,
    tokens: tokenEstimate(toMake.length),
  };
}
