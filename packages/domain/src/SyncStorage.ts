import type { OutboxEntry, OutboxFailure, OutboxKind } from "./OutboxEntry.js";
import type { RecordChange } from "./RecordChange.js";
import type { StoredTranscript } from "./StoredTranscript.js";

export type WriteAcknowledgement = { rev: number } | { tombstoned: true } | { sent: true };

// Folded into the account's copy (docs/features/one-overview-per-video.md).
export interface OverviewFold {
  from: string;
  into: string;
}

// The client half of sync, which the engine never bypasses (docs/features/sync-client.md).
export interface SyncStorage {
  isEnrolled(): Promise<boolean>;
  // So the first sync pushes everything and every later write is journaled.
  enrol(): Promise<void>;
  // The reverse, for signing out: the records stay, the sync bookkeeping goes.
  leave(): Promise<void>;
  cursor(): Promise<number>;
  listPending(): Promise<OutboxEntry[]>;
  acknowledge(key: number, outcome: WriteAcknowledgement): Promise<void>;
  park(key: number, failure: OutboxFailure): Promise<void>;
  revisionOf(kind: OutboxKind, id: string): Promise<number | null>;
  // Null, touching nothing, until the other copy is readable here (docs/features/one-overview-per-video.md).
  foldOverview(from: string, into: string): Promise<OverviewFold | null>;
  // One page of the feed, applied atomically with the cursor that follows it.
  applyChanges(changes: RecordChange[], next: number): Promise<void>;
  onJournaled(listener: () => void): () => void;
  // Read when pushed; null once no note here uses the video, so a deleted note's isn't sent.
  transcriptToPush(videoId: string): Promise<StoredTranscript | null>;
  // A transcript fetched from the server, kept without journaling, as a pulled record is.
  keepTranscript(transcript: StoredTranscript): Promise<void>;
}
