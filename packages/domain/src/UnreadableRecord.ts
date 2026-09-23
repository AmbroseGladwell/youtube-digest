import { salvageOverview, type SalvagedOverview } from "./SalvagedOverview.js";

// future-version is the stale client and resolves when the app updates; the other two are
// the record, and stay until a migration is written (docs/features/record-migrations.md).
export type UnreadableReason = "future-version" | "unmigratable" | "invalid";

export type UnreadableRecordKind = "overview" | "overviewState" | "topic" | "settings";

export interface UnreadableRecord {
  kind: UnreadableRecordKind;
  id: string;
  schemaVersion: number;
  reason: UnreadableReason;
  detail: string;
  salvaged: SalvagedOverview | null;
}

export interface UnreadableRecordFailure {
  reason: UnreadableReason;
  schemaVersion: number;
  detail: string;
}

export function unreadableRecord(
  kind: UnreadableRecordKind,
  id: string,
  failure: UnreadableRecordFailure,
  raw: unknown,
): UnreadableRecord {
  return {
    kind,
    id,
    schemaVersion: failure.schemaVersion,
    reason: failure.reason,
    detail: failure.detail,
    salvaged: kind === "overview" ? salvageOverview(raw) : null,
  };
}
