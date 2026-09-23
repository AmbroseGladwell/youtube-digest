import type { TranscriptSegment, VideoSource } from "@overview/domain";

export interface FetchedTranscript {
  video: VideoSource;
  transcript: TranscriptSegment[];
  generated: boolean;
}
