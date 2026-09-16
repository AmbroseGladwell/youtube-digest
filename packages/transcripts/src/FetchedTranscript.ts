import type { TranscriptSegment, VideoSource } from "@digest/types";

export interface FetchedTranscript {
  video: VideoSource;
  transcript: TranscriptSegment[];
  generated: boolean;
}
