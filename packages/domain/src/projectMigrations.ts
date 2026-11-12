import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const PROJECT_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_PROJECT_SCHEMA_VERSION = currentSchemaVersion(PROJECT_MIGRATIONS);
