import { VideoId, type StoredTranscript } from "@overview/types";

export function makeStoredTranscript(overrides: Partial<StoredTranscript> = {}): StoredTranscript {
  return {
    videoId: VideoId.parse("example"),
    segments: [
      { text: "Hello and welcome.", startMs: 0, endMs: 3000 },
      { text: "Here is the one claim this video makes.", startMs: 3000, endMs: 7000 },
    ],
    generated: false,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}
