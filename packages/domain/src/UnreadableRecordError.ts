import type { UnreadableRecord } from "./UnreadableRecord.js";

// Thrown rather than returned as null, because null already means no such record and a
// record that is still in the store is not absent (docs/features/record-migrations.md).
export class UnreadableRecordError extends Error {
  readonly record: UnreadableRecord;

  constructor(record: UnreadableRecord) {
    super(`the ${record.kind} record ${record.id} could not be read: ${record.reason}`);
    this.name = "UnreadableRecordError";
    this.record = record;
    this.cause = record.detail;
  }
}

export const isUnreadableRecordError = (error: unknown): error is UnreadableRecordError =>
  error instanceof UnreadableRecordError;
