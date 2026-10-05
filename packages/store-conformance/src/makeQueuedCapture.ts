import { PlaylistId, VideoId, type QueuedCapture } from "@overview/domain";

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
