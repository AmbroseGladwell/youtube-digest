import type { ServiceTranscriptStatus, StoredTranscript, VideoId } from "@overview/domain";

// Our own server fetching a transcript, the ladder's last rung, with or without a session
// (docs/architecture/server-side-transcripts.md).
export interface ServiceTranscriptApi {
  status(): Promise<ServiceTranscriptStatus>;
  fetch(videoId: VideoId): Promise<StoredTranscript>;
}
