import { PlaylistId, VideoId, type PlaylistEntry, type PlaylistLookup } from "@overview/domain";
import { IWFT_VIDEO_ID } from "./innerTubeFixtures.js";

export const PSYCHOLOGY_ID = "PLFs4vir_WsTwEd";
export const PSYCHOLOGY_URL = `https://www.youtube.com/playlist?list=${PSYCHOLOGY_ID}`;

export const playlistEntry = (videoId: string, title: string, addedAt: string, overrides: Partial<PlaylistEntry> = {}): PlaylistEntry => ({
  videoId: VideoId.parse(videoId),
  title,
  channel: "Veritasium",
  thumbnailUrl: null,
  addedAt,
  availability: "available",
  ...overrides,
});

// The fixture video, added first, and a second one added a day later.
export const psychologyPlaylist = (entries: PlaylistEntry[] = [
  playlistEntry(IWFT_VIDEO_ID, "The Simulated Video", "2026-09-01T09:00:00.000Z"),
  playlistEntry("secondVideo1", "How Your Brain Fills In the Gaps", "2026-09-02T09:00:00.000Z"),
]): PlaylistLookup => ({
  id: PlaylistId.parse(PSYCHOLOGY_ID),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  entries,
});
