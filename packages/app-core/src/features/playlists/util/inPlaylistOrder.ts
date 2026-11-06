import type { PlaylistEntry, PlaylistOrder } from "@overview/domain";

// Where a video sits in the playlist it came from: when YouTube says it was added, and its
// place in the playlist's own order.
export interface PlaylistPlace {
  addedAt: string | null;
  playlistIndex: number | null;
}

export interface PlacedPlaylistEntry extends PlaylistEntry {
  playlistIndex: number;
}

// A lookup answers in the playlist's own order, so each entry's place is where it arrives.
export function placedEntries(entries: readonly PlaylistEntry[]): PlacedPlaylistEntry[] {
  return entries.map((entry, playlistIndex) => ({ ...entry, playlistIndex }));
}

// The order a playlist's videos are made in (docs/features/playlists.md, "An order for each
// playlist"). Newest first is oldest first turned round, and the playlist's own order decides
// wherever YouTube gives no date. A video queued before there was an order to keep has no
// place of its own, so it keeps the one it already has here.
export function inPlaylistOrder<Place extends PlaylistPlace>(places: readonly Place[], order: PlaylistOrder): Place[] {
  const placed = places.map((place, position) => ({ place, index: place.playlistIndex ?? position }));
  const byIndex = (left: (typeof placed)[number], right: (typeof placed)[number]) => left.index - right.index;
  if (order === "playlistOrder") return placed.sort(byIndex).map(({ place }) => place);
  const oldestFirst = placed.sort((left, right) => {
    const byAdded =
      left.place.addedAt === null || right.place.addedAt === null ? 0 : left.place.addedAt.localeCompare(right.place.addedAt);
    return byAdded === 0 ? byIndex(left, right) : byAdded;
  });
  return (order === "newestFirst" ? oldestFirst.reverse() : oldestFirst).map(({ place }) => place);
}
