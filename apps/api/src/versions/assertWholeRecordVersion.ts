import { CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import type { RecordKind } from "../records/RecordKind.js";
import type { ClientContext } from "./ClientContext.js";

// A client never writes at a version other than its own maximum. A client above every
// row of the version table is only known to be at least the last row, so anything at or
// above the server's current version is accepted from it (docs/architecture/api.md).
export function assertWholeRecordVersion(kind: RecordKind, bodySchemaVersion: number, client: ClientContext): void {
  const expected = client.schemaVersions[kind];
  const aboveTheTable = expected === CURRENT_SCHEMA_VERSIONS[kind] && bodySchemaVersion > expected;
  if (bodySchemaVersion !== expected && !aboveTheTable) {
    throw new ApiError("invalid_request", `A ${kind} from this client must be written at schema version ${expected}`, {
      kind,
      bodySchemaVersion,
      clientSchemaVersion: expected,
    });
  }
}
