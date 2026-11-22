import type {
  ClaimSummary,
  NoteKind,
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
  existingProjects: FilingProject[];
  pastClaims: ClaimSummary[];
  // Most used first: docs/features/tag-reuse.md, "The model is offered the reader's tags".
  existingTags: TagCount[];
  tagAliases: TagAliases;
  // Checked before the account (OV-327), so writing skips its own check.
  noteKind?: NoteKind | undefined;
}
