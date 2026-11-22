import type { PlaylistOrigin, QueuedCapture } from "@overview/domain";
import { canonicalYouTubeUrl } from "../../newOverview/util/parseYouTubeUrl.js";
import type { PlacedPlaylistEntry } from "./inPlaylistOrder.js";

// A millisecond apart, so the queue keeps the order they were handed over in.
export const capturesFor = (entries: PlacedPlaylistEntry[], fromPlaylist: PlaylistOrigin, now: Date): QueuedCapture[] => {
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
};
