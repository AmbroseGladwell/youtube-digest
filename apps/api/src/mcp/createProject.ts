import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CURRENT_SCHEMA_VERSIONS, MAX_PROJECT_PURPOSE_LENGTH, ProjectName, sameTopicName, type Project } from "@overview/domain";
import { decideReplace } from "../records/decideReplace.js";
import { logRecordWritten } from "../records/logRecordWritten.js";
import { serverClientContext } from "../versions/serverClientContext.js";
import { OVERVIEWS_PER_MARK } from "./markOverviews.js";
import { mcpTool, toolError } from "./McpTool.js";
import { projectMemberWrite } from "./projectMemberWrite.js";
import { projectWriteRefusal } from "./projectWriteRefusal.js";
import { readLibrary } from "./readLibrary.js";

const Input = z.object({
  name: ProjectName.describe("What the reader calls it, such as Kitchen renovation"),
  purpose: z
    .string()
    .trim()
    .min(1)
    .max(MAX_PROJECT_PURPOSE_LENGTH)
    .optional()
    .describe(
      "What the project is for, as the reader put it: one line an assistant will read as the brief. Leave it out rather than invent one",
    ),
  ids: z
    .array(z.string())
    .max(OVERVIEWS_PER_MARK)
    .optional()
    .describe(`Overviews to put in it from the start, by id. At most ${OVERVIEWS_PER_MARK}`),
});

// Made by the assistant and marked as its own; only the reader renames, archives or deletes
// a project (docs/features/projects.md).
export const createProject = mcpTool({
  name: "create_project",
  title: "Make a project",
  description:
    "Make a project for something the reader is working on, when they ask: a name, the purpose in their own words, and optionally the overviews that belong in it. The project and every overview added are marked as added by this assistant, and the reader can take any of them out. A project can't be renamed, archived or deleted from here. Refused if a project of that name already exists: add to it with change_project_members instead.",
  input: Input,
  writes: true,
  idempotent: false,
  run: async ({ name, purpose, ids = [] }, { sql, accountId, records, clock, log, connection }) => {
    const library = await readLibrary(sql, accountId);
    const existing = library.projects.find((project) => sameTopicName(project.name, name));
    if (existing !== undefined) {
      return toolError(
        `A project called "${existing.name}" already exists (id ${existing.id}${existing.archivedAt === null ? "" : ", archived"}). Add to it with change_project_members.`,
      );
    }
    const wanted = [...new Set(ids)];
    const held = new Set<string>(library.entries.map((entry) => entry.overview.id));
    const adding = wanted.filter((id) => held.has(id));
    const missing = wanted.filter((id) => !held.has(id));
    const now = clock();
    const by = { by: "assistant" as const, connectionId: connection.id, name: connection.name };
    const project: Project = {
      id: randomUUID() as Project["id"],
      name,
      purpose: purpose ?? null,
      createdAt: now.toISOString(),
      createdBy: by,
      archivedAt: null,
    };

    try {
      const written = await records.write(accountId, [
        {
          kind: "project",
          id: project.id,
          decide: (current) =>
            decideReplace(
              "project",
              current,
              { body: project, schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: now.toISOString(), ifMatch: null },
              serverClientContext,
            ),
        },
        ...adding.map((overviewId) => projectMemberWrite(project.id, overviewId, "add", by, now)),
      ]);
      for (const outcome of written) if (outcome !== null) logRecordWritten(log, outcome);
    } catch (error) {
      const refusal = projectWriteRefusal(error);
      if (refusal !== null) return refusal;
      throw error;
    }

    const titles = new Map<string, string>(library.entries.map((entry) => [entry.overview.id, entry.overview.source.title]));
    const lines = [
      `Made the project "${project.name}" (id ${project.id})${project.purpose === null ? ", with no purpose: the reader can add one in the app." : "."}`,
      ...(adding.length === 0 ? [] : [`Added ${adding.length} overview(s):`, ...adding.map((id) => `- **${titles.get(id)}**`)]),
      ...(missing.length === 0 ? [] : [`Not in this library, so not added: ${missing.join(", ")}.`]),
    ];
    return { text: lines.join("\n"), overviews: adding.length, project: { id: project.id, hasPurpose: project.purpose !== null } };
  },
});
