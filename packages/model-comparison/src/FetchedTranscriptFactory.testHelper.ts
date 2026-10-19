import { VideoId } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";

export const SEGMENT_MS = 30_000;

export function makeFetchedTranscript(segments = 30, overrides: Partial<FetchedTranscript["video"]> = {}): FetchedTranscript {
  return {
    video: {
      id: VideoId.parse("video-one"),
      url: "https://www.youtube.com/watch?v=video-one",
      title: "Saving 20% on groceries",
      channel: "Thrift Lab",
      description: "We tried it for 3 months.",
      durationMs: segments * SEGMENT_MS,
      publishedAt: null,
      thumbnailUrl: null,
      ...overrides,
    },
    transcript: Array.from({ length: segments }, (_, index) => ({
      text: index === 4 ? "We spent $1,200 a month before and 960 after." : `Segment ${index} talks about shopping.`,
      startMs: index * SEGMENT_MS,
      endMs: (index + 1) * SEGMENT_MS,
    })),
    generated: false,
  };
}
