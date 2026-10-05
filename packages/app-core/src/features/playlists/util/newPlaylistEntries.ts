import type { FollowedPlaylist, PlaylistCheck, PlaylistEntry, PlaylistLookup, VideoId } from "@overview/domain";

export interface NewPlaylistEntries {
  fresh: PlaylistEntry[];
  seen: VideoId[];
}

// What a check of a followed playlist should queue. Against what this device has seen, not
// a date, because a playlist can be reordered by hand. A device checking a playlist it never
// has (one followed on another device) counts what was added after the follow
// (docs/features/playlists.md, "New entries").
export function newPlaylistEntries(
  lookup: PlaylistLookup,
  playlist: FollowedPlaylist,
  check: PlaylistCheck | null,
  known: ReadonlySet<string>,
): NewPlaylistEntries {
  const seenBefore = new Set<string>(check?.seenVideoIds ?? []);
  const isNew = (entry: PlaylistEntry) =>
    check === null ? entry.addedAt !== null && entry.addedAt > playlist.followedAt : !seenBefore.has(entry.videoId);
  return {
    fresh: lookup.entries.filter((entry) => isNew(entry) && !known.has(entry.videoId)),
    seen: lookup.entries.map((entry) => entry.videoId),
  };
}
