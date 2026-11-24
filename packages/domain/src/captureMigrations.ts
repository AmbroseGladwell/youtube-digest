import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const CAPTURE_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_CAPTURE_SCHEMA_VERSION = currentSchemaVersion(CAPTURE_MIGRATIONS);
