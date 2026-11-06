import type { PlaylistOrigin, QueuedCapture } from "@overview/domain";
import { canonicalYouTubeUrl } from "../../newOverview/util/parseYouTubeUrl.js";
import type { PlacedPlaylistEntry } from "./inPlaylistOrder.js";

// Each entry as a queued video, a millisecond apart so the queue keeps the order they were
// handed over in, carrying where it sat in its playlist so the queue can reorder it when the
// reader asks for another order. A video YouTube will not show is queued as skipped, so it
// explains itself rather than vanishing (docs/features/capture-queue.md).
export function capturesFor(entries: PlacedPlaylistEntry[], fromPlaylist: PlaylistOrigin, now: Date): QueuedCapture[] {
  return entries.map((entry, index) => ({
    videoId: entry.videoId,
    url: canonicalYouTubeUrl(`https://www.youtube.com/watch?v=${entry.videoId}`)!,
    title: entry.title,
    thumbnailUrl: entry.thumbnailUrl,
    fromPlaylist,
    queuedAt: new Date(now.getTime() + index).toISOString(),
    status: entry.availability === "available" ? "waiting" : "skipped",
    problem: entry.availability === "available" ? null : entry.availability,
    chosenAt: null,
    addedAt: entry.addedAt,
    playlistIndex: entry.playlistIndex,
  }));
}
