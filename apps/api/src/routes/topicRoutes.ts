import type { FastifyInstance } from "fastify";
import { TopicId } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { sendWritten } from "../http/writeHeaders.js";
import { decideReplace } from "../records/decideReplace.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

// Create-only: nothing edits a topic yet, so nothing replaces one
// (docs/features/sync-metadata.md, "Topic is stamped for the rule").
export function topicRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.post("/topics", async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The topic");
    const id = parseOrThrow(TopicId, body.id, "The topic's id");
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "topic",
        id,
        decide: (current) =>
          decideReplace("topic", current, { body, schemaVersion, updatedAt, ifMatch: null }, request.client!),
      },
    ]);
    return sendWritten(reply, written!, 201);
  });
}
