import type { StoredTranscript, VideoId } from "@overview/domain";

// The cross-account transcript cache, readable without a session
// (docs/features/shared-transcript-cache.md).
export interface SharedTranscriptApi {
  // Null when no account has stored a transcript of the video.
  get(videoId: VideoId): Promise<StoredTranscript | null>;
}
