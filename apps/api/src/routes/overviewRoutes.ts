import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_OVERVIEW_STATE, OverviewId, OverviewState, TopicId } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { ifMatchOf, sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import { decideReplace } from "../records/decideReplace.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import { ApiError } from "../http/ApiError.js";

const Params = z.object({ id: OverviewId });
const TopicsPatch = z.object({ topicIds: z.array(TopicId), updatedAt: UpdatedAt });
const CaptureReasonPatch = z.object({ captureReason: z.string().nullable(), updatedAt: UpdatedAt });
const StatePatch = OverviewState.pick({ read: true, favourite: true, userTags: true })
  .partial()
  .extend({ updatedAt: UpdatedAt });

export function overviewRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.post("/overviews", async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The overview");
    const id = parseOrThrow(OverviewId, body.id, "The overview's id");
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "overview",
        id,
        decide: (current) =>
          decideReplace("overview", current, { body, schemaVersion, updatedAt, ifMatch }, request.client!),
      },
    ]);
    return sendWritten(reply, written!, ifMatch === null ? 201 : 200);
  });

  app.put("/overviews/:id/topics", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The overview's id");
    const { topicIds, updatedAt } = parseOrThrow(TopicsPatch, request.body, "The topics patch");
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "overview",
        id,
        decide: (current) =>
          decideMerge("overview", current, { patch: { topicIds }, updatedAt, ifMatch, defaults: null }, request.client!),
      },
    ]);
    return sendWritten(reply, written!);
  });

  app.put("/overviews/:id/capture-reason", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The overview's id");
    const { captureReason, updatedAt } = parseOrThrow(CaptureReasonPatch, request.body, "The capture reason");
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "overview",
        id,
        decide: (current) =>
          decideMerge(
            "overview",
            current,
            { patch: { captureReason }, updatedAt, ifMatch, defaults: null },
            request.client!,
          ),
      },
    ]);
    return sendWritten(reply, written!);
  });

  app.put("/overviews/:id/state", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The overview's id");
    const { updatedAt, ...patch } = parseOrThrow(StatePatch, request.body, "The state patch");
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_request", "The state patch changes nothing");
    }
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "overviewState",
        id,
        decide: (current) =>
          decideMerge(
            "overviewState",
            current,
            {
              patch: { ...patch, overviewId: id },
              updatedAt,
              ifMatch,
              defaults: { ...DEFAULT_OVERVIEW_STATE, overviewId: id },
            },
            request.client!,
          ),
      },
    ]);
    return sendWritten(reply, written!);
  });

  // The state row goes with the overview: ids are never reused, so a surviving state
  // would be a permanent orphan on every device (docs/features/sync-api.md).
  app.delete("/overviews/:id", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The overview's id");
    const ifMatch = ifMatchOf(request);
    const [overview] = await records.write(request.session!.accountId, [
      { kind: "overview", id, decide: (current) => decideTombstone("overview", current, ifMatch, request.client!) },
      { kind: "overviewState", id, decide: (current) => decideTombstone("overviewState", current, null, request.client!) },
    ]);
    return overview === null || overview === undefined ? reply.status(204).send() : sendWritten(reply, overview);
  });
}
