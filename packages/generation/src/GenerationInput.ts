import type { ClaimSummary, SectionsEnabled, Topic, TranscriptSegment, VideoSource } from "@overview/domain";

export interface GenerationInput {
  video: VideoSource;
  transcript: TranscriptSegment[];
  captureReason: string | null;
  readerContext: string | null;
  sectionsEnabled: SectionsEnabled;
  existingTopics: Topic[];
  pastClaims: ClaimSummary[];
}
