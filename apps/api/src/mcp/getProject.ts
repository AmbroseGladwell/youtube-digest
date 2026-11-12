import { z } from "zod";
import { projectMarkdown } from "@overview/domain";
import { mcpTool } from "./McpTool.js";
import { pageOf } from "./pageOf.js";
import { projectOverviews } from "./projectOverviews.js";
import { readLibrary } from "./readLibrary.js";
import { isProject, resolveProject } from "./resolveProject.js";

// How to apply has at most three steps, so a page is at most 75 of them beside the listing
// (docs/features/projects.md, "get_project").
export const PROJECT_PAGE_SIZE = 25;

export const getProject = mcpTool({
  name: "get_project",
  title: "Read a project",
  description: `Read one project as a brief: the reader's purpose for it in their own words, how many overviews and how many unread, the spread of verdicts, then its overviews freshest verdict first (dubious ones flagged, and those an assistant added marked), and every How to apply step from them gathered in one place. ${PROJECT_PAGE_SIZE} overviews a page, with a cursor. Read the full notes with get_overviews and the same project.`,
  input: z.object({
    project: z.string().describe("The project's name or id, as list_projects gives them"),
    cursor: z.string().regex(/^\d+$/).optional().describe("Where to carry on from: the cursor the previous call ended with"),
  }),
  run: async ({ project: nameOrId, cursor }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const project = resolveProject(library, nameOrId);
    if (!isProject(project)) return project;
    const items = projectOverviews(library, project.id);
    const page = pageOf(items, cursor, PROJECT_PAGE_SIZE);
    const footer = [
      ...(page.total > page.items.length && page.items.length > 0
        ? [`These are overviews ${page.first + 1}–${page.first + page.items.length} of ${page.total}.`]
        : []),
      ...(page.next === null ? [] : [`More remain: call again with cursor "${page.next}".`]),
    ];
    const text = projectMarkdown(project, items, { from: page.first, count: PROJECT_PAGE_SIZE });
    return { text: [text.trim(), ...footer].join("\n\n"), overviews: page.items.length };
  },
});
