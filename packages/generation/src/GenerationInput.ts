import type { ClaimSummary, SectionsEnabled, Topic, VideoSource } from "@digest/types";
import type { TranscriptSegment } from "./TranscriptSegment.js";

export interface GenerationInput {
  video: VideoSource;
  transcript: TranscriptSegment[];
  savedNote: string | null;
  readerContext: string | null;
  sectionsEnabled: SectionsEnabled;
  existingTopics: Topic[];
  pastClaims: ClaimSummary[];
}
