import type { ClaimSummary, SectionsEnabled, Topic, TranscriptSegment, VideoSource } from "@digest/types";

export interface GenerationInput {
  video: VideoSource;
  transcript: TranscriptSegment[];
  savedNote: string | null;
  readerContext: string | null;
  sectionsEnabled: SectionsEnabled;
  existingTopics: Topic[];
  pastClaims: ClaimSummary[];
}
