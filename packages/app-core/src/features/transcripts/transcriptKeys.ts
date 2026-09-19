import type { VideoId } from "@overview/types";

export const transcriptKeys = {
  all: ["transcript"] as const,
  // Nullable because a note saved before transcripts were stored has no video id to key
  // by: that query never runs, and never shares a cache entry with one that does.
  detail: (videoId: VideoId | null) => [...transcriptKeys.all, "detail", videoId] as const,
  // Keyed by URL, not by video id: the point of this one is to answer before any call has
  // told us what the id is (docs/features/watching-detection.md).
  watched: (url: string | null) => [...transcriptKeys.all, "watched", url] as const,
};
