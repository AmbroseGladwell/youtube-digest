import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

export const FOLLOWED_PLAYLIST_MIGRATIONS: readonly RecordMigration[] = [];

export const CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION = currentSchemaVersion(FOLLOWED_PLAYLIST_MIGRATIONS);
