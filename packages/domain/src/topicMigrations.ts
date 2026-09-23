import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const TOPIC_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_TOPIC_SCHEMA_VERSION = currentSchemaVersion(TOPIC_MIGRATIONS);
