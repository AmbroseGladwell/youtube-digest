import type { OutboxEntry, OutboxFailure } from "./OutboxEntry.js";
import type { RecordChange } from "./RecordChange.js";
import type { SyncedRecordKind } from "./SchemaVersions.js";

export type WriteAcknowledgement = { rev: number } | { tombstoned: true };

// The durable client-side half of sync, which the engine drives and never bypasses: the
// outbox, the revision known for each record, the feed cursor, and whether this library
// has been enrolled at all (docs/features/sync-client.md).
export interface SyncStorage {
  isEnrolled(): Promise<boolean>;
  // Journals every record the library already holds, so the first sync pushes everything,
  // and marks the library enrolled so that every write from here on is journaled too.
  enrol(): Promise<void>;
  // The reverse, for signing out: the records stay, the sync bookkeeping goes.
  leave(): Promise<void>;
  cursor(): Promise<number>;
  listPending(): Promise<OutboxEntry[]>;
  acknowledge(key: number, outcome: WriteAcknowledgement): Promise<void>;
  park(key: number, failure: OutboxFailure): Promise<void>;
  revisionOf(kind: SyncedRecordKind, id: string): Promise<number | null>;
  // One page of the feed, applied atomically with the cursor that follows it.
  applyChanges(changes: RecordChange[], next: number): Promise<void>;
  onJournaled(listener: () => void): () => void;
}
