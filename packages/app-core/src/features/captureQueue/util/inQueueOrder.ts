import type { PlaylistId, PlaylistOrder, QueuedCapture } from "@overview/domain";
import { inPlaylistOrder } from "../../playlists/util/inPlaylistOrder.js";

// Each playlist's waiting videos in that playlist's order, without moving them past anything
// else: a playlist keeps the places in the queue it already holds, and only what sits in them
// changes. So a playlist whose order the reader has just changed turns round on its own, and
// every other playlist stays where it was (docs/features/playlists.md, "An order for each
// playlist").
export function inQueueOrder(
  waiting: readonly QueuedCapture[],
  orderOf: (playlistId: PlaylistId) => PlaylistOrder,
): QueuedCapture[] {
  const places = new Map<PlaylistId, number[]>();
  waiting.forEach((capture, place) => {
    const taken = places.get(capture.fromPlaylist.id);
    if (taken === undefined) places.set(capture.fromPlaylist.id, [place]);
    else taken.push(place);
  });

  const ordered = [...waiting];
  for (const [playlistId, taken] of places) {
    const sorted = inPlaylistOrder(
      taken.map((place) => waiting[place]!),
      orderOf(playlistId),
    );
    taken.forEach((place, index) => {
      ordered[place] = sorted[index]!;
    });
  }
  return ordered;
}
