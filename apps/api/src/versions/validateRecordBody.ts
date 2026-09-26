import { CURRENT_SCHEMA_VERSIONS, readStoredRecord, stampSchemaVersion } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import type { RecordKind } from "../records/RecordKind.js";
import { RECORD_KINDS } from "../records/recordKinds.js";

// Migrating to the current shape and parsing is how the server asks "is this a valid
// record?" of a version it knows. A version it does not know yet is stored as given,
// because the shape it would check against does not exist here
// (docs/features/sync-api.md).
export function validateRecordBody(kind: RecordKind, body: Record<string, unknown>, schemaVersion: number): void {
  if (schemaVersion > CURRENT_SCHEMA_VERSIONS[kind]) {
    return;
  }
  const { schema, migrations } = RECORD_KINDS[kind];
  const read = readStoredRecord(stampSchemaVersion(body, schemaVersion), schema, migrations);
  if (read.status === "unreadable") {
    throw new ApiError("invalid_request", `The ${kind} is not valid at schema version ${schemaVersion}`, {
      detail: read.detail,
    });
  }
}
