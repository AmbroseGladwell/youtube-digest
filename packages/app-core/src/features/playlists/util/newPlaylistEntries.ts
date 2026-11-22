import type { FollowedPlaylist, PlaylistCheck, PlaylistEntry, PlaylistLookup, VideoId } from "@overview/domain";
import { placedEntries, type PlacedPlaylistEntry } from "./inPlaylistOrder.js";

export interface NewPlaylistEntries {
  fresh: PlacedPlaylistEntry[];
  seen: VideoId[];
}

// Against what this device has seen, not a date: docs/features/playlists.md, "New entries".
export const newPlaylistEntries = (
  lookup: PlaylistLookup,
  playlist: FollowedPlaylist,
  check: PlaylistCheck | null,
  known: ReadonlySet<string>,
): NewPlaylistEntries => {
  const seenBefore = new Set<string>(check?.seenVideoIds ?? []);
  const isNew = (entry: PlaylistEntry) =>
    check === null ? entry.addedAt !== null && entry.addedAt > playlist.followedAt : !seenBefore.has(entry.videoId);
  return {
    fresh: placedEntries(lookup.entries).filter((entry) => isNew(entry) && !known.has(entry.videoId)),
    seen: lookup.entries.map((entry) => entry.videoId),
  };
};
