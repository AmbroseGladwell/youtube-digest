import type { RecordKind } from "./RecordKind.js";

export interface StoredRecord {
  kind: RecordKind;
  id: string;
  schemaVersion: number;
  rev: number;
  seq: number;
  updatedAt: string | null;
  deleted: boolean;
  body: Record<string, unknown> | null;
}

export interface RecordRow {
  kind: RecordKind;
  id: string;
  schema_version: number;
  rev: number;
  seq: number | string | bigint;
  updated_at: string | null;
  deleted: boolean;
  body: Record<string, unknown> | null;
}

// int8 comes back as a string from pg and as a bigint from PGlite; one mapper settles it.
export const storedRecordFromRow = (row: RecordRow): StoredRecord => ({
  kind: row.kind,
  id: row.id,
  schemaVersion: row.schema_version,
  rev: row.rev,
  seq: Number(row.seq),
  updatedAt: row.updated_at,
  deleted: row.deleted,
  body: row.body,
});
