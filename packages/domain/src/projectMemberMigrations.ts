import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Additive: filing authors are held back from older clients (docs/features/record-migrations.md).
const allowFilingAsTheAuthor: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => record,
};

export const PROJECT_MEMBER_MIGRATIONS: readonly RecordMigration[] = [allowFilingAsTheAuthor];

export const CURRENT_PROJECT_MEMBER_SCHEMA_VERSION = currentSchemaVersion(PROJECT_MEMBER_MIGRATIONS);
