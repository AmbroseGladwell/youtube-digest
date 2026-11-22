import { CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import type { RecordKind } from "../records/RecordKind.js";
import type { ClientContext } from "./ClientContext.js";

// Why at or above current is accepted: docs/architecture/api.md, "Versions on the wire".
export const assertWholeRecordVersion = (kind: RecordKind, bodySchemaVersion: number, client: ClientContext): void => {
  const expected = client.schemaVersions[kind];
  const aboveTheTable = expected === CURRENT_SCHEMA_VERSIONS[kind] && bodySchemaVersion > expected;
  if (bodySchemaVersion !== expected && !aboveTheTable) {
    throw new ApiError("invalid_request", `A ${kind} from this client must be written at schema version ${expected}`, {
      kind,
      bodySchemaVersion,
      clientSchemaVersion: expected,
    });
  }
};
