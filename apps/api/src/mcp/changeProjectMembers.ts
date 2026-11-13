import { z } from "zod";
import { logRecordWritten } from "../records/logRecordWritten.js";
import { OVERVIEWS_PER_MARK } from "./markOverviews.js";
import { mcpTool, toolError } from "./McpTool.js";
import { projectMemberWrite } from "./projectMemberWrite.js";
import { projectOverviews } from "./projectOverviews.js";
import { projectWriteRefusal } from "./projectWriteRefusal.js";
import { readLibrary } from "./readLibrary.js";
import { isProject, resolveProject } from "./resolveProject.js";

const Ids = (verb: string) => z.array(z.string()).optional().describe(`Overviews to ${verb}, by id`);

const Input = z
  .object({
    project: z.string().describe("The project's name or id, as list_projects gives them"),
    add: Ids("put in the project"),
    remove: Ids("take out of the project"),
  })
  .refine((input) => (input.add?.length ?? 0) + (input.remove?.length ?? 0) > 0, { message: "Give add, remove or both" })
  .refine((input) => (input.add?.length ?? 0) + (input.remove?.length ?? 0) <= OVERVIEWS_PER_MARK, {
    message: `At most ${OVERVIEWS_PER_MARK} overviews a call, added and removed together`,
  });

const titled = (titles: Map<string, string>, ids: string[]) => ids.map((id) => `- **${titles.get(id)}**`);

// Idempotent: an overview already in, or already out, is left as it is and said so, so the
// feed carries no empty change.
export const changeProjectMembers = mcpTool({
  name: "change_project_members",
  title: "Add to or take from a project",
  description: `Put overviews in a project, or take them out, by id, when the reader asks or agrees: for instance after finding the ones that belong with search_overviews. At most ${OVERVIEWS_PER_MARK} a call. What this assistant adds is marked as its own, and the reader can take it out. Never changes the overviews themselves, nor the project's name or purpose.`,
  input: Input,
  writes: true,
  run: async ({ project: nameOrId, add = [], remove = [] }, { sql, accountId, records, clock, log, connection }) => {
    const library = await readLibrary(sql, accountId);
    const project = resolveProject(library, nameOrId);
    if (!isProject(project)) return project;
    const inside = new Set<string>(projectOverviews(library, project.id).map(({ overview }) => overview.id));
    const held = new Set<string>(library.entries.map((entry) => entry.overview.id));
    const titles = new Map<string, string>(library.entries.map((entry) => [entry.overview.id, entry.overview.source.title]));
    const adds = [...new Set(add)];
    const removes = [...new Set(remove)].filter((id) => !adds.includes(id));
    const missing = [...adds, ...removes].filter((id) => !held.has(id));
    const adding = adds.filter((id) => held.has(id) && !inside.has(id));
    const alreadyIn = adds.filter((id) => held.has(id) && inside.has(id));
    const removing = removes.filter((id) => held.has(id) && inside.has(id));
    const alreadyOut = removes.filter((id) => held.has(id) && !inside.has(id));
    if (missing.length === adds.length + removes.length) {
      return toolError(`Not in this library: ${missing.join(", ")}. search_overviews gives each overview's id.`);
    }

    const now = clock();
    const by = { by: "assistant" as const, connectionId: connection.id, name: connection.name };
    try {
      const written = await records.write(accountId, [
        ...adding.map((overviewId) => projectMemberWrite(project.id, overviewId, "add", by, now)),
        ...removing.map((overviewId) => projectMemberWrite(project.id, overviewId, "remove", by, now)),
      ]);
      for (const outcome of written) if (outcome !== null) logRecordWritten(log, outcome);
    } catch (error) {
      const refusal = projectWriteRefusal(error);
      if (refusal !== null) return refusal;
      throw error;
    }

    const lines = [
      ...(adding.length === 0 ? [] : [`Added ${adding.length} overview(s) to "${project.name}":`, ...titled(titles, adding)]),
      ...(removing.length === 0 ? [] : [`Took ${removing.length} overview(s) out of "${project.name}":`, ...titled(titles, removing)]),
      ...(alreadyIn.length === 0 ? [] : ["Already in it, left as they were:", ...titled(titles, alreadyIn)]),
      ...(alreadyOut.length === 0 ? [] : ["Not in it, so nothing to take out:", ...titled(titles, alreadyOut)]),
      ...(missing.length === 0 ? [] : [`Not in this library: ${missing.join(", ")}.`]),
      ...(project.archivedAt === null ? [] : ["This project is archived, so the reader finds it under archived projects."]),
    ];
    return { text: lines.join("\n"), overviews: adding.length + removing.length };
  },
});
