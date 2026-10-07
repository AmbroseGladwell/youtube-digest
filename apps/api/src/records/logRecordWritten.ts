import type { FastifyBaseLogger } from "fastify";
import { apiLogLines } from "@overview/domain";
import type { WriteOutcome } from "./RecordsRepository.js";

export function logRecordWritten(log: FastifyBaseLogger, written: WriteOutcome): void {
  const { kind, id, rev, seq, deleted, schemaVersion, previousSchemaVersion } = written;
  log.info(
    apiLogLines.sync.recordWritten({
      kind,
      id,
      rev,
      seq,
      deleted,
      schemaVersion,
      ...(previousSchemaVersion !== null && previousSchemaVersion !== schemaVersion ? { migratedFrom: previousSchemaVersion } : {}),
    }),
  );
}
