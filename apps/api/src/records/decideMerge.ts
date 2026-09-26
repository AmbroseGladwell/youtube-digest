import { CURRENT_SCHEMA_VERSIONS, migrateStoredRecord, stampSchemaVersion } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { assertRecordWritable } from "../versions/assertRecordWritable.js";
import type { ClientContext } from "../versions/ClientContext.js";
import { validateRecordBody } from "../versions/validateRecordBody.js";
import type { RecordKind } from "./RecordKind.js";
import { RECORD_KINDS } from "./recordKinds.js";
import type { StoredRecord } from "./StoredRecord.js";
import type { WriteDecision } from "./WriteDecision.js";

export interface MergeRequest {
  patch: Record<string, unknown>;
  updatedAt: string;
  ifMatch: number | null;
  // What an absent record starts from, or null when a patch to an absent record is a 404.
  defaults: Record<string, unknown> | null;
  merge?: (base: Record<string, unknown>, patch: Record<string, unknown>) => Record<string, unknown>;
}

const spread = (base: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...base, ...patch });

// The stored body is migrated to the caller's version before the patch is merged into it,
// never parsed: parsing would strip a newer client's fields, and merging into an
// unmigrated body would be undone by the chain on the next read
// (docs/features/sync-api.md, docs/features/record-migrations.md).
export function decideMerge(
  kind: RecordKind,
  current: StoredRecord | null,
  request: MergeRequest,
  client: ClientContext,
): WriteDecision {
  const live = current !== null && !current.deleted ? current : null;
  const writeVersion = Math.min(client.schemaVersions[kind], CURRENT_SCHEMA_VERSIONS[kind]);
  const merge = request.merge ?? spread;

  let base: Record<string, unknown>;
  if (live === null) {
    if (request.defaults === null) {
      throw new ApiError("not_found", `No such ${kind}`);
    }
    base = request.defaults;
  } else {
    if (request.ifMatch !== null && request.ifMatch !== live.rev) {
      throw new ApiError("revision_mismatch", "The record has changed since it was read", { rev: live.rev });
    }
    assertRecordWritable(kind, live.schemaVersion, client);
    const migrated = migrateStoredRecord(
      stampSchemaVersion(live.body ?? {}, live.schemaVersion),
      RECORD_KINDS[kind].migrations.filter((migration) => migration.newSchemaVersion <= writeVersion),
    );
    if (migrated.status === "unreadable") {
      throw new ApiError("record_newer_than_client", migrated.detail, {
        kind,
        storedSchemaVersion: live.schemaVersion,
        clientSchemaVersion: client.schemaVersions[kind],
      });
    }
    const { schemaVersion: _version, ...body } = migrated.record;
    base = request.defaults === null ? body : { ...request.defaults, ...body };
  }

  const merged = merge(base, request.patch);
  validateRecordBody(kind, merged, writeVersion);
  return { action: "upsert", body: merged, schemaVersion: writeVersion, updatedAt: request.updatedAt };
}
