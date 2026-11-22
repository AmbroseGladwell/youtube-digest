import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Empty: DEFAULT_OVERVIEW_STATE answers new fields on read (docs/features/record-migrations.md).
export const OVERVIEW_STATE_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_OVERVIEW_STATE_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_STATE_MIGRATIONS);
