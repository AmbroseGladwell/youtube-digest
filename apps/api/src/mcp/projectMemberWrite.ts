import { memberChangeTime, mergeProjectMember, projectMemberId, type ProjectAuthor } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { decideMerge } from "../records/decideMerge.js";
import type { WriteOperation } from "../records/RecordsRepository.js";
import { serverClientContext } from "../versions/serverClientContext.js";

// An assistant's add or removal, dated by the server's clock and never later than the
// membership record's last change: an assistant is never asked the time (CLAUDE.md).
export function projectMemberWrite(
  projectId: string,
  overviewId: string,
  change: "add" | "remove",
  by: ProjectAuthor,
  now: Date,
): WriteOperation {
  const id = projectMemberId(projectId, overviewId);
  return {
    kind: "projectMember",
    id,
    requires: [{ kind: "project", id: projectId }],
    decide: (current, _held, [project]) => {
      if (project == null || project.deleted) throw new ApiError("not_found", "No such project");
      const at = memberChangeTime(current?.deleted === false ? (current.body ?? undefined) : undefined, now);
      return decideMerge(
        "projectMember",
        current,
        {
          patch: change === "add" ? { addedAt: at, addedBy: by } : { removedAt: at },
          updatedAt: now.toISOString(),
          ifMatch: null,
          defaults: change === "add" ? { id, projectId, overviewId, removedAt: null } : null,
          merge: mergeProjectMember,
        },
        serverClientContext,
      );
    },
  };
}
