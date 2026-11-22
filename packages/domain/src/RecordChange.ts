import { z } from "zod";
import { SYNCED_RECORD_KINDS, type SyncedRecordKind } from "./SchemaVersions.js";

// Stamps beside the body, and no body on a tombstone (docs/features/sync-api.md).
export const RecordChange = z.object({
  kind: z.enum(SYNCED_RECORD_KINDS as [SyncedRecordKind, ...SyncedRecordKind[]]),
  id: z.string().min(1),
  schemaVersion: z.int().min(1),
  rev: z.int().min(1),
  seq: z.int().min(1),
  updatedAt: z.string().nullable(),
  deleted: z.boolean(),
  body: z.record(z.string(), z.unknown()).optional(),
});
export type RecordChange = z.infer<typeof RecordChange>;

export const RecordChangesPage = z.object({
  changes: z.array(RecordChange),
  next: z.int().min(0),
  more: z.boolean(),
});
export type RecordChangesPage = z.infer<typeof RecordChangesPage>;

export const WrittenRecord = z.object({
  id: z.string().min(1),
  rev: z.int().min(1),
  seq: z.int().min(1),
});
export type WrittenRecord = z.infer<typeof WrittenRecord>;
