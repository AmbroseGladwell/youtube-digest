import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SYNCED_RECORD_KINDS, UNKNOWN_KIND_SCHEMA_VERSION } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";

const ChangesQuery = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

const change = (record: StoredRecord) => ({
  kind: record.kind,
  id: record.id,
  schemaVersion: record.schemaVersion,
  rev: record.rev,
  seq: record.seq,
  updatedAt: record.updatedAt,
  deleted: record.deleted,
  ...(record.body === null ? {} : { body: record.body }),
});

export function changesRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.get("/changes", async (request) => {
    const { since, limit } = parseOrThrow(ChangesQuery, request.query, "The changes query");
    const { schemaVersions } = request.client!;
    const kinds = SYNCED_RECORD_KINDS.filter((kind) => schemaVersions[kind] > UNKNOWN_KIND_SCHEMA_VERSION);
    const page = await records.listChanges(request.session!.accountId, since, limit, kinds);
    request.log.info({ since, next: page.next, count: page.changes.length, more: page.more }, "changes served");
    return { changes: page.changes.map(change), next: page.next, more: page.more };
  });
}
