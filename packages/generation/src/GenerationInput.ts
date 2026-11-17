import type {
  ClaimSummary,
  FilingProject,
  SectionsEnabled,
  TagAliases,
  TagCount,
  Topic,
  TranscriptSegment,
  VideoSource,
} from "@overview/domain";

export interface GenerationInput {
  video: VideoSource;
  transcript: TranscriptSegment[];
  captureReason: string | null;
  readerContext: string | null;
  sectionsEnabled: SectionsEnabled;
  existingTopics: Topic[];
  // Empty when the reader has none, or has switched filing into them off.
  existingProjects: FilingProject[];
  pastClaims: ClaimSummary[];
  // Every tag in the reader's library, most used first.
  existingTags: TagCount[];
  tagAliases: TagAliases;
}
