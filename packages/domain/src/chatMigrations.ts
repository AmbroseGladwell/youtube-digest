import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// 2: a citation of the overview's own items (OV-319), which a client before it can't read.
export const CHAT_MIGRATIONS: readonly RecordMigration[] = [{ newSchemaVersion: 2 }];

export const CURRENT_CHAT_SCHEMA_VERSION = currentSchemaVersion(CHAT_MIGRATIONS);
