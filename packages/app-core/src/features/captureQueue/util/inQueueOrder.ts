import type { PlaylistId, PlaylistOrder, QueuedCapture } from "@overview/domain";
import { inPlaylistOrder } from "../../playlists/util/inPlaylistOrder.js";

// Why each playlist keeps its places: docs/features/playlists.md, "An order for each playlist".
export const inQueueOrder = (waiting: readonly QueuedCapture[], orderOf: (playlistId: PlaylistId) => PlaylistOrder): QueuedCapture[] => {
  const places = new Map<PlaylistId, number[]>();
  waiting.forEach((capture, place) => {
    const taken = places.get(capture.fromPlaylist.id);
    if (taken === undefined) {
      places.set(capture.fromPlaylist.id, [place]);
    } else {
      taken.push(place);
    }
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
};
