import type { FastifyBaseLogger } from "fastify";
import type { WriteOutcome } from "./RecordsRepository.js";

export function logRecordWritten(log: FastifyBaseLogger, written: WriteOutcome): void {
  const { kind, id, rev, seq, deleted, schemaVersion, previousSchemaVersion } = written;
  log.info(
    {
      kind,
      id,
      rev,
      seq,
      deleted,
      schemaVersion,
      ...(previousSchemaVersion !== null && previousSchemaVersion !== schemaVersion ? { migratedFrom: previousSchemaVersion } : {}),
    },
    "record written",
  );
}
