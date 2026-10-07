import type { OutboxEntry, OutboxFailure, OutboxKind } from "./OutboxEntry.js";
import type { RecordChange } from "./RecordChange.js";
import type { StoredTranscript } from "./StoredTranscript.js";

export type WriteAcknowledgement = { rev: number } | { tombstoned: true } | { sent: true };

// A duplicate made on this device folded into the account's copy of the same video
// (docs/features/one-overview-per-video.md).
export interface OverviewFold {
  from: string;
  into: string;
}

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
  revisionOf(kind: OutboxKind, id: string): Promise<number | null>;
  // The server holds another overview of the video this one is of. Its filing and state are
  // folded onto that copy as journaled writes, this copy and its pending writes go, and its
  // transcript write is re-pointed. Null when the other copy is not readable here yet, so
  // nothing is touched (docs/features/one-overview-per-video.md).
  foldOverview(from: string, into: string): Promise<OverviewFold | null>;
  // One page of the feed, applied atomically with the cursor that follows it.
  applyChanges(changes: RecordChange[], next: number): Promise<void>;
  onJournaled(listener: () => void): () => void;
  // What a transcript entry pushes, read when it is pushed rather than when it was journaled.
  // Null once no note on this device uses the video, so a deleted note's transcript is not sent.
  transcriptToPush(videoId: string): Promise<StoredTranscript | null>;
  // A transcript fetched from the server, kept without journaling, as a pulled record is.
  keepTranscript(transcript: StoredTranscript): Promise<void>;
}
