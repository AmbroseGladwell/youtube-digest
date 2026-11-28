import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

const allowFeedEntries: RecordMigration = { newSchemaVersion: 2 };

export const CAPTURE_MIGRATIONS: readonly RecordMigration[] = [allowFeedEntries];

export const CURRENT_CAPTURE_SCHEMA_VERSION = currentSchemaVersion(CAPTURE_MIGRATIONS);
