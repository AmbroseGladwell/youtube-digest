import {
  PlaylistId,
  VideoId,
  type FollowedPlaylist,
  type PlaylistEntry,
  type PlaylistLookup,
  type QueuedCapture,
} from "@overview/domain";

export const makeFollowedPlaylist = (overrides: Partial<FollowedPlaylist> = {}): FollowedPlaylist => ({
  id: PlaylistId.parse("PLpsychology"),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  followedAt: "2026-10-05T09:00:00.000Z",
  unavailable: null,
  ...overrides,
});

export const makePlaylistEntry = (videoId: string, overrides: Partial<PlaylistEntry> = {}): PlaylistEntry => ({
  videoId: VideoId.parse(videoId),
  title: `Video ${videoId}`,
  channel: "Veritasium",
  thumbnailUrl: null,
  addedAt: "2026-09-01T09:00:00.000Z",
  availability: "available",
  ...overrides,
});

export const makePlaylistLookup = (overrides: Partial<PlaylistLookup> = {}): PlaylistLookup => ({
  id: PlaylistId.parse("PLpsychology"),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  entries: [],
  ...overrides,
});

export const makeQueuedCapture = (overrides: Partial<QueuedCapture> = {}): QueuedCapture => {
  const videoId = overrides.videoId ?? VideoId.parse("k3Gw0Nhk2Ls");
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: "Why We Can't Remember Being Babies",
    thumbnailUrl: null,
    fromPlaylist: { id: PlaylistId.parse("PLpsychology"), title: "Psychology" },
    queuedAt: "2026-10-05T09:00:00.000Z",
    status: "waiting",
    problem: null,
    ...overrides,
  };
};
