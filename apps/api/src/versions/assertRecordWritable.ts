import { ApiError } from "../http/ApiError.js";
import type { RecordKind } from "../records/RecordKind.js";
import type { ClientContext } from "./ClientContext.js";

// A client may write to a record it can read, and no further: enforced here against the
// stored record's version rather than trusted to the client
// (docs/features/record-migrations.md).
export function assertRecordWritable(
  kind: RecordKind,
  storedSchemaVersion: number,
  client: ClientContext,
): void {
  const clientSchemaVersion = client.schemaVersions[kind];
  if (storedSchemaVersion > clientSchemaVersion) {
    throw new ApiError("record_newer_than_client", "This record was written by a newer version of the app", {
      kind,
      storedSchemaVersion,
      clientSchemaVersion,
    });
  }
}
