import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const SUGGESTED_QUESTION_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_SUGGESTED_QUESTION_SCHEMA_VERSION = currentSchemaVersion(SUGGESTED_QUESTION_MIGRATIONS);
