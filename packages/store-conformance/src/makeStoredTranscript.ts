import { VideoId, type StoredTranscript } from "@overview/types";

export function makeStoredTranscript(overrides: Partial<StoredTranscript> = {}): StoredTranscript {
  const videoId = overrides.videoId ?? VideoId.parse("example");
  return {
    videoId,
    segments: [
      { text: "Hello and welcome.", startMs: 0, endMs: 3000 },
      { text: "Here is the one claim this video makes.", startMs: 3000, endMs: 7000 },
    ],
    generated: false,
    fetchedAt: new Date().toISOString(),
    video: {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: "Example",
      channel: "Example Channel",
      description: null,
      durationMs: null,
      publishedAt: null,
      thumbnailUrl: null,
    },
    ...overrides,
  };
}
