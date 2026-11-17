import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Additive: a membership record can now be filing's, which a client from before cannot read, so
// it is held back from them rather than met as a value they have never heard of
// (docs/features/record-migrations.md).
const allowFilingAsTheAuthor: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => record,
};

export const PROJECT_MEMBER_MIGRATIONS: readonly RecordMigration[] = [allowFilingAsTheAuthor];

export const CURRENT_PROJECT_MEMBER_SCHEMA_VERSION = currentSchemaVersion(PROJECT_MEMBER_MIGRATIONS);
