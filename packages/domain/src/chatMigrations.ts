import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const CHAT_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_CHAT_SCHEMA_VERSION = currentSchemaVersion(CHAT_MIGRATIONS);
