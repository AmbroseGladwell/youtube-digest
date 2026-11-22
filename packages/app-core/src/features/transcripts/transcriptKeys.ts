import type { VideoId } from "@overview/domain";

export const transcriptKeys = {
  all: ["transcript"] as const,
  // Null for a note saved before transcripts were stored; fromServer makes signing in ask again.
  detail: (videoId: VideoId | null, fromServer: boolean) => [...transcriptKeys.all, "detail", videoId, fromServer] as const,
  // By URL: it answers before any call has told us the video id.
  watched: (url: string | null) => [...transcriptKeys.all, "watched", url] as const,
  serviceStatus: (apiUrl: string | null) => [...transcriptKeys.all, "serviceStatus", apiUrl] as const,
};
