import { ApiError } from "../http/ApiError.js";
import { assertRecordWritable } from "../versions/assertRecordWritable.js";
import { assertWholeRecordVersion } from "../versions/assertWholeRecordVersion.js";
import type { ClientContext } from "../versions/ClientContext.js";
import { validateRecordBody } from "../versions/validateRecordBody.js";
import type { RecordKind } from "./RecordKind.js";
import type { StoredRecord } from "./StoredRecord.js";
import type { WriteDecision } from "./WriteDecision.js";

export interface ReplaceRequest {
  body: Record<string, unknown>;
  schemaVersion: number;
  updatedAt: string;
  ifMatch: number | null;
}

// A whole-record write over a record the client has not read is the clobber the docs
// exist to prevent, so without If-Match it is create-only (docs/features/sync-api.md).
export function decideReplace(
  kind: RecordKind,
  current: StoredRecord | null,
  request: ReplaceRequest,
  client: ClientContext,
): WriteDecision {
  const live = current !== null && !current.deleted ? current : null;
  if (live !== null) {
    if (request.ifMatch === null) {
      throw new ApiError("already_exists", `That ${kind} already exists; send If-Match to replace it`, {
        rev: live.rev,
      });
    }
    if (request.ifMatch !== live.rev) {
      throw new ApiError("revision_mismatch", "The record has changed since it was read", { rev: live.rev });
    }
    assertRecordWritable(kind, live.schemaVersion, client);
  } else if (request.ifMatch !== null) {
    throw new ApiError("not_found", `No such ${kind} to replace`);
  }
  assertWholeRecordVersion(kind, request.schemaVersion, client);
  validateRecordBody(kind, request.body, request.schemaVersion);
  return { action: "upsert", body: request.body, schemaVersion: request.schemaVersion, updatedAt: request.updatedAt };
}
