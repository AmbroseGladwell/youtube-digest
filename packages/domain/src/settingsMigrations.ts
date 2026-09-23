import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const SETTINGS_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_SETTINGS_SCHEMA_VERSION = currentSchemaVersion(SETTINGS_MIGRATIONS);
