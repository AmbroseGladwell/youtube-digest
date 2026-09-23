import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Empty, and may well stay empty: DEFAULT_OVERVIEW_STATE is merged over every read, so a
// field added tomorrow is already answered for every record written yesterday. A
// migration is only needed where a default cannot express the answer
// (docs/features/record-migrations.md).
export const OVERVIEW_STATE_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_OVERVIEW_STATE_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_STATE_MIGRATIONS);
