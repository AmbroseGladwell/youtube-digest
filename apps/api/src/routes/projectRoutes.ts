import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, BY_READER, mergeProjectMember, OverviewId, ProjectId, ProjectPatch, projectMemberId } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import { decideReplace } from "../records/decideReplace.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import { tombstoneProjectMembers } from "../records/tombstoneProjectMembers.js";

const Params = z.object({ id: ProjectId });
const MemberParams = z.object({ projectId: ProjectId, overviewId: OverviewId });
const Patch = ProjectPatch.extend({ updatedAt: UpdatedAt });
const MemberChange = z.union([
  z.object({ addedAt: UpdatedAt, updatedAt: UpdatedAt }).strict(),
  z.object({ removedAt: UpdatedAt, updatedAt: UpdatedAt }).strict(),
]);

const isLive = (record: StoredRecord | null): boolean => record !== null && !record.deleted;

// A reader's own writes. What an assistant does goes through the connector, which marks it
// as the assistant's (docs/features/projects.md).
export function projectRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.post("/projects", async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The project");
    const id = parseOrThrow(ProjectId, body.id, "The project's id");
    if ((body.createdBy as { by?: unknown } | undefined)?.by !== BY_READER.by) {
      throw new ApiError("invalid_request", "A project made in the app is made by the reader");
    }
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "project",
        id,
        decide: (current) => decideReplace("project", current, { body, schemaVersion, updatedAt, ifMatch: null }, request.client!),
      },
    ]);
    return sendWritten(reply, written!, 201);
  });

  app.put("/projects/:id", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The project's id");
    const { updatedAt, ...patch } = parseOrThrow(Patch, request.body, "The project patch");
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_request", "The project patch changes nothing");
    }
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "project",
        id,
        decide: (current) => decideMerge("project", current, { patch, updatedAt, ifMatch: null, defaults: null }, request.client!),
      },
    ]);
    return sendWritten(reply, written!);
  });

  app.delete("/projects/:id", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The project's id");
    const accountId = request.session!.accountId;
    const [project] = await records.write(accountId, [
      { kind: "project", id, decide: (current) => decideTombstone("project", current, null, request.client!) },
    ]);
    await tombstoneProjectMembers(records, accountId, { projectId: id });
    if (project === null || project === undefined) {
      request.log.info(apiLogLines.sync.recordAlreadyDeleted({ kind: "project", id }));
      return reply.status(204).send();
    }
    return sendWritten(reply, project);
  });

  // An overview can only be added to a project that is there, and never for an overview that is
  // gone. One for an overview not pushed yet is allowed, since it may still be on its way.
  app.put("/projects/:projectId/members/:overviewId", async (request, reply) => {
    const { projectId, overviewId } = parseOrThrow(MemberParams, request.params, "The project member");
    const { updatedAt, ...change } = parseOrThrow(MemberChange, request.body, "The project member change");
    const id = projectMemberId(projectId, overviewId);
    const adding = "addedAt" in change;
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "projectMember",
        id,
        requires: [
          { kind: "project", id: projectId },
          { kind: "overview", id: overviewId },
        ],
        decide: (current, _held, [project, overview]) => {
          if (!isLive(project ?? null)) throw new ApiError("not_found", "No such project");
          if (adding && overview?.deleted === true) throw new ApiError("not_found", "No such overview");
          return decideMerge(
            "projectMember",
            current,
            {
              patch: "addedAt" in change ? { addedAt: change.addedAt, addedBy: BY_READER } : change,
              updatedAt,
              ifMatch: null,
              defaults: adding ? { id, projectId, overviewId, removedAt: null } : null,
              merge: mergeProjectMember,
            },
            request.client!,
          );
        },
      },
    ]);
    return sendWritten(reply, written!);
  });
}
