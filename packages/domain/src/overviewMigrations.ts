import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

const VIDEO_FIELDS_ADDED_AFTER_THE_FIRST_NOTES = ["durationMs", "publishedAt", "thumbnailUrl"];

// The three fields whose absence produced a missing image, a NaN:NaN duration and a
// RangeError that took the page down. Null is what the schema already says each of them
// means for a note generated before the field existed
// (docs/features/record-migrations.md).
const fillVideoFieldsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { video } = record as { video?: unknown };
    if (typeof video !== "object" || video === null) {
      return record;
    }
    const filled: Record<string, unknown> = { ...(video as Record<string, unknown>) };
    for (const field of VIDEO_FIELDS_ADDED_AFTER_THE_FIRST_NOTES) {
      if (!(field in filled)) {
        filled[field] = null;
      }
    }
    return { ...record, video: filled };
  },
};

// A rename is derivable: the record already holds the value, under the other key
// (docs/features/record-migrations.md). Nothing has shipped and no client but this one
// writes, so the deprecation window that a rename would otherwise need — write both names,
// raise the write floor, then drop one — is not needed and is not built.
const renameSavedNoteToCaptureReason: RecordMigration = {
  newSchemaVersion: 3,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { savedNote, ...rest } = record as Record<string, unknown>;
    return { ...rest, captureReason: savedNote ?? null };
  },
};

// Not derivable: nothing in an older record says where its video's subject changes, so
// the honest value is the one the reader is told about (docs/features/chapters.md).
const fillChaptersAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 4,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "chapters" in record ? record : { ...record, chapters: null };
  },
};

export const OVERVIEW_MIGRATIONS: readonly RecordMigration[] = [
  fillVideoFieldsAddedAfterTheFirstNotes,
  renameSavedNoteToCaptureReason,
  fillChaptersAddedAfterTheFirstNotes,
];

export const CURRENT_OVERVIEW_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_MIGRATIONS);
