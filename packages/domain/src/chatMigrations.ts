import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// 2: a citation of the overview's own items (OV-319), which a client before it can't read.
// 3: a citation of another of the reader's overviews (OV-355), likewise.
export const CHAT_MIGRATIONS: readonly RecordMigration[] = [{ newSchemaVersion: 2 }, { newSchemaVersion: 3 }];

export const CURRENT_CHAT_SCHEMA_VERSION = currentSchemaVersion(CHAT_MIGRATIONS);
