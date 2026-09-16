import type { TranscriptSegment, VideoSource } from "@overview/types";

export interface FetchedTranscript {
  video: VideoSource;
  transcript: TranscriptSegment[];
  generated: boolean;
}
