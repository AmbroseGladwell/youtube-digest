import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const FOLLOWED_FEED_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_FOLLOWED_FEED_SCHEMA_VERSION = currentSchemaVersion(FOLLOWED_FEED_MIGRATIONS);
