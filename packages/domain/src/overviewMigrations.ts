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

export const OVERVIEW_MIGRATIONS: readonly RecordMigration[] = [
  fillVideoFieldsAddedAfterTheFirstNotes,
];

export const CURRENT_OVERVIEW_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_MIGRATIONS);
