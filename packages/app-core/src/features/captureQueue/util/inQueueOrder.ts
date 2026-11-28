import { queueOriginOf, type PlaylistOrder, type QueuedCapture } from "@overview/domain";
import { inPlaylistOrder } from "../../playlists/util/inPlaylistOrder.js";

// Why each playlist or feed keeps its places: docs/features/playlists.md, "An order for each playlist".
export const inQueueOrder = (waiting: readonly QueuedCapture[], orderOf: (originId: string) => PlaylistOrder): QueuedCapture[] => {
  const places = new Map<string, number[]>();
  waiting.forEach((capture, place) => {
    const { id } = queueOriginOf(capture);
    const taken = places.get(id);
    if (taken === undefined) {
      places.set(id, [place]);
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
