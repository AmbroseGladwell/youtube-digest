import type { ServiceTranscriptStatus, StoredTranscript, VideoId } from "@overview/domain";

export interface ServiceTranscriptApi {
  status(): Promise<ServiceTranscriptStatus>;
  fetch(videoId: VideoId): Promise<StoredTranscript>;
}
