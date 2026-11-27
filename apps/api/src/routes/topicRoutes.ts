import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, OverviewId, Topic, TopicId, TopicPatch } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import { decideReplace } from "../records/decideReplace.js";
import { foldSameNameTopics, type TopicNameFold } from "../records/foldSameNameTopics.js";
import { foldTopicInto } from "../records/foldTopicInto.js";
import { restoreTopic } from "../records/restoreTopic.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const TOPIC_ID = "The topic's id";
const TOPIC_PATH = "/topics/:id";
const Params = z.object({ id: TopicId });
const Patch = TopicPatch.extend({ updatedAt: UpdatedAt });
const Merge = z.object({ into: TopicId, updatedAt: UpdatedAt }).strict();
const OverviewIds = z.array(OverviewId).max(5000);
const Restore = Topic.omit({ id: true }).extend({ into: TopicId, refiled: OverviewIds, added: OverviewIds, updatedAt: UpdatedAt }).strict();
const Delete = z.object({ updatedAt: UpdatedAt.optional() }).strict();

// Rename, merge and delete: docs/features/topic-filing.md, "Managing topics".
export const topicRoutes = (app: FastifyInstance, records: RecordsRepository): void => {
  app.post("/topics", async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The topic");
    const id = parseOrThrow(TopicId, body.id, TOPIC_ID);
    const accountId = request.session!.accountId;
    const [written] = await records.write(accountId, [
      {
        kind: "topic",
        id,
        decide: (current) => decideReplace("topic", current, { body, schemaVersion, updatedAt, ifMatch: null }, request.client!),
      },
    ]);
    logFolds(request.log, await foldSameNameTopics(records, accountId, updatedAt, request.client!));
    return sendWritten(reply, written!, 201);
  });

  app.put(TOPIC_PATH, async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, TOPIC_ID);
    const { updatedAt, ...patch } = parseOrThrow(Patch, request.body, "The topic patch");
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_request", "The topic patch changes nothing");
    }
    const accountId = request.session!.accountId;
    const [written] = await records.write(accountId, [
      {
        kind: "topic",
        id,
        decide: (current) => decideMerge("topic", current, { patch, updatedAt, ifMatch: null, defaults: null }, request.client!),
      },
    ]);
    request.log.info(apiLogLines.topics.renamed({ topicId: id }));
    logFolds(request.log, await foldSameNameTopics(records, accountId, updatedAt, request.client!));
    return sendWritten(reply, written!);
  });

  app.post("/topics/:id/merge", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, TOPIC_ID);
    const { into, updatedAt } = parseOrThrow(Merge, request.body, "The topic merge");
    if (into === id) {
      throw new ApiError("invalid_request", "A topic cannot be merged into itself");
    }
    const accountId = request.session!.accountId;
    const target = await records.read(accountId, "topic", into);
    if (target === null || target.deleted) {
      throw new ApiError("not_found", "No such topic to merge into");
    }
    const folded = await foldTopicInto(records, accountId, { from: id, into, updatedAt, client: request.client! });
    request.log.info(apiLogLines.topics.merged({ topicId: id, into, refiled: folded.refiled.length }));
    return reply.status(200).send(folded);
  });

  app.post("/topics/:id/restore", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, TOPIC_ID);
    const { into, refiled, added, updatedAt, ...topic } = parseOrThrow(Restore, request.body, "The topic restore");
    await restoreTopic(records, request.session!.accountId, {
      topic: { id, ...topic },
      into,
      refiled,
      added,
      updatedAt,
      client: request.client!,
    });
    request.log.info(apiLogLines.topics.restored({ topicId: id, refiled: refiled.length }));
    return reply.status(204).send();
  });

  app.delete(TOPIC_PATH, async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, TOPIC_ID);
    const { updatedAt = new Date().toISOString() } = parseOrThrow(Delete, request.body ?? {}, "The topic delete");
    const { refiled } = await foldTopicInto(records, request.session!.accountId, {
      from: id,
      into: null,
      updatedAt,
      client: request.client!,
    });
    request.log.info(apiLogLines.topics.deleted({ topicId: id, unfiled: refiled.length }));
    return reply.status(204).send();
  });
};

const logFolds = (log: FastifyBaseLogger, folds: TopicNameFold[]): void => {
  for (const fold of folds) {
    log.info(apiLogLines.topics.folded(fold));
  }
};
