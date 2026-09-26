import { ApiError } from "../http/ApiError.js";
import { assertRecordWritable } from "../versions/assertRecordWritable.js";
import type { ClientContext } from "../versions/ClientContext.js";
import type { RecordKind } from "./RecordKind.js";
import type { StoredRecord } from "./StoredRecord.js";
import type { WriteDecision } from "./WriteDecision.js";

export function decideTombstone(
  kind: RecordKind,
  current: StoredRecord | null,
  ifMatch: number | null,
  client: ClientContext,
): WriteDecision {
  if (current === null || current.deleted) {
    return { action: "nothing" };
  }
  if (ifMatch !== null && ifMatch !== current.rev) {
    throw new ApiError("revision_mismatch", "The record has changed since it was read", { rev: current.rev });
  }
  assertRecordWritable(kind, current.schemaVersion, client);
  return { action: "tombstone" };
}
