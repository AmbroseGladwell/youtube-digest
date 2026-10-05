import type { VideoId } from "@overview/domain";

export const transcriptKeys = {
  all: ["transcript"] as const,
  // Nullable because a note saved before transcripts were stored has no video id to key
  // by: that query never runs, and never shares a cache entry with one that does.
  // Keyed by whether the server can be asked too, so signing in asks again.
  detail: (videoId: VideoId | null, fromServer: boolean) =>
    [...transcriptKeys.all, "detail", videoId, fromServer] as const,
  // Keyed by URL, not by video id: the point of this one is to answer before any call has
  // told us what the id is (docs/features/watching-detection.md).
  watched: (url: string | null) => [...transcriptKeys.all, "watched", url] as const,
  serviceStatus: (apiUrl: string | null) => [...transcriptKeys.all, "serviceStatus", apiUrl] as const,
};
