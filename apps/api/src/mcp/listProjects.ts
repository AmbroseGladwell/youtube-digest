import { z } from "zod";
import { authorName, verdictSpread, verdictSpreadLine, type Project } from "@overview/domain";
import type { Library } from "./Library.js";
import { mcpTool } from "./McpTool.js";
import { pageOf } from "./pageOf.js";
import { projectOverviews } from "./projectOverviews.js";
import { readLibrary } from "./readLibrary.js";

export const PROJECTS_PAGE_SIZE = 50;

const latest = (dates: Array<string | null>): string =>
  dates
    .filter((date) => date !== null)
    .sort()
    .at(-1) ?? "";

const lastChanged = (library: Library, project: Project): string =>
  latest([
    project.createdAt,
    project.archivedAt,
    ...library.members.filter((member) => member.projectId === project.id).flatMap((member) => [member.addedAt, member.removedAt]),
  ]);

function projectLines(library: Library, project: Project): string {
  const items = projectOverviews(library, project.id);
  const unread = items.filter((item) => !item.read).length;
  const spread = verdictSpreadLine(verdictSpread(items.map((item) => item.overview)));
  const facts = [
    `${items.length} overview(s)`,
    `${unread} unread`,
    ...(spread === "" ? [] : [spread]),
    `last changed ${lastChanged(library, project).slice(0, 10)}`,
    `made by ${authorName(project.createdBy)}`,
  ];
  return [
    `- **${project.name}**${project.archivedAt === null ? "" : " (archived)"} · id ${project.id}`,
    `  ${project.purpose === null ? "No purpose given." : `Purpose: ${project.purpose}`}`,
    `  ${facts.join(" · ")}`,
  ].join("\n");
}

export const listProjects = mcpTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List the reader's projects: things they are working on, such as a renovation or a launch, each with a purpose line in their own words saying what it is for, and the overviews they are using for it. Reach for a project when the reader asks about something they are doing; a topic says what an overview is about, and a tag names a subject. Gives each project's id, purpose, how many overviews and how many unread, the spread of verdicts, and when it last changed, most recently changed first. Archived projects are left out unless archived is true.",
  input: z.object({
    archived: z.boolean().optional().describe("true to include archived projects"),
    cursor: z.string().regex(/^\d+$/).optional().describe("Where to carry on from: the cursor the previous call ended with"),
  }),
  run: async ({ archived, cursor }, { sql, accountId, writes }) => {
    const library = await readLibrary(sql, accountId);
    const hidden = library.projects.filter((project) => project.archivedAt !== null).length;
    const shown = library.projects
      .filter((project) => archived === true || project.archivedAt === null)
      .map((project) => ({ project, changed: lastChanged(library, project) }))
      .sort((left, right) => right.changed.localeCompare(left.changed));
    if (shown.length === 0) {
      const none =
        hidden > 0 && archived !== true ? `The reader has no active projects, and ${hidden} archived.` : "The reader has no projects yet.";
      const next = writes
        ? "When the reader asks, create_project makes one with their purpose and the overviews that belong in it."
        : "The reader can make one in the app.";
      return { text: `${none} ${next}` };
    }
    const page = pageOf(shown, cursor, PROJECTS_PAGE_SIZE);
    const lines = [
      `${page.total} project(s)${archived === true ? "" : ", active only"}:`,
      ...page.items.map(({ project }) => projectLines(library, project)),
      ...(page.next === null ? [] : [`More remain: call again with cursor "${page.next}".`]),
      ...(archived !== true && hidden > 0 ? [`${hidden} archived project(s) left out: pass archived: true to see them.`] : []),
      "Read one as a brief with get_project.",
    ];
    return { text: lines.join("\n") };
  },
});
