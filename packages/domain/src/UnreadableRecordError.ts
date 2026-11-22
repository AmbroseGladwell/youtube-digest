import type { UnreadableRecord } from "./UnreadableRecord.js";

// Null already means no such record (docs/features/record-migrations.md).
export class UnreadableRecordError extends Error {
  readonly record: UnreadableRecord;

  constructor(record: UnreadableRecord) {
    super(`the ${record.kind} record ${record.id} could not be read: ${record.reason}`);
    this.name = "UnreadableRecordError";
    this.record = record;
    this.cause = record.detail;
  }
}

export const isUnreadableRecordError = (error: unknown): error is UnreadableRecordError => error instanceof UnreadableRecordError;
