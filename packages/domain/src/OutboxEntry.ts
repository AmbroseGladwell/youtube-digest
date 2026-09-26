import type { SyncedRecordKind } from "./SchemaVersions.js";

// What one local write journals, in the same transaction as the write itself. The change
// is the exact thing that changed rather than the record that contains it, so two devices
// editing different fields of one record commute on the server as they do locally
// (docs/features/sync-client.md).
export type OutboxChange =
  | { op: "replace"; record: Record<string, unknown> }
  | { op: "topics"; topicIds: string[] }
  | { op: "captureReason"; captureReason: string | null }
  | { op: "state"; patch: Record<string, unknown> }
  | { op: "settings"; patch: Record<string, unknown> }
  | { op: "delete" };

export interface OutboxFailure {
  code: string;
  message: string;
}

export interface PendingWrite {
  kind: SyncedRecordKind;
  id: string;
  updatedAt: string;
  change: OutboxChange;
}

export interface OutboxEntry extends PendingWrite {
  key: number;
  // A write the server refused for a reason no resend can change. It stays, counted, rather
  // than being dropped, and every later write to the same record waits behind it.
  stuck: OutboxFailure | null;
}
