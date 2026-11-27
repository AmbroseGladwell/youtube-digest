import type { SyncedRecordKind } from "./SchemaVersions.js";

// The exact change, so edits to different fields commute on the server (docs/features/sync-client.md).
export type OutboxChange =
  | { op: "replace"; record: Record<string, unknown> }
  | { op: "topics"; topicIds: string[]; edited?: true }
  | { op: "captureReason"; captureReason: string | null; edited?: true }
  | { op: "tags"; tags: string[]; edited?: true }
  | { op: "state"; patch: Record<string, unknown> }
  | { op: "settings"; patch: Record<string, unknown> }
  | { op: "project"; patch: Record<string, unknown> }
  | { op: "topic"; patch: Record<string, unknown> }
  | { op: "mergeTopic"; into: string }
  | { op: "restoreTopic"; restore: Record<string, unknown> }
  | { op: "member"; change: Record<string, unknown> }
  | { op: "suggestedQuestion"; change: Record<string, unknown> }
  | { op: "delete" }
  // No body: read from the store when pushed, behind its note (docs/features/transcript-storage.md).
  | { op: "transcript"; overviewId: string };

// Transcripts are journaled and pushed like records, but never come down the feed.
export type OutboxKind = SyncedRecordKind | "transcript";

export interface OutboxFailure {
  code: string;
  message: string;
}

export interface PendingWrite {
  kind: OutboxKind;
  id: string;
  updatedAt: string;
  change: OutboxChange;
}

export interface OutboxEntry extends PendingWrite {
  key: number;
  // Never dropped; later writes to the record wait behind it.
  stuck: OutboxFailure | null;
}
