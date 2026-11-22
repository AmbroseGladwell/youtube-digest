import { CURRENT_SCHEMA_VERSIONS, readStoredRecord, stampSchemaVersion } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import type { RecordKind } from "../records/RecordKind.js";
import { RECORD_KINDS } from "../records/recordKinds.js";

// Why an unknown version is stored as given: docs/features/sync-api.md, "Validation by migrating to current".
export const validateRecordBody = (kind: RecordKind, body: Record<string, unknown>, schemaVersion: number): void => {
  if (schemaVersion > CURRENT_SCHEMA_VERSIONS[kind]) {
    return;
  }
  const { schema, migrations } = RECORD_KINDS[kind];
  const read = readStoredRecord(stampSchemaVersion(body, schemaVersion), schema, migrations);
  if (read.status === "unreadable") {
    throw new ApiError("invalid_request", `The ${kind} is not valid at schema version ${schemaVersion}`, {
      kind,
      schemaVersion,
      detail: read.detail,
    });
  }
};
