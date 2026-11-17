import { z } from "zod";
import { chatQuestionCount } from "@overview/domain";
import { mcpTool, toolError } from "./McpTool.js";
import { pageOf } from "./pageOf.js";
import { projectOverviews } from "./projectOverviews.js";
import { lastMessageAt, readChats } from "./readChats.js";
import { readLibrary } from "./readLibrary.js";
import { isProject, resolveProject } from "./resolveProject.js";

// As a listing of overviews pages (docs/features/mcp-connector.md, "The context budget").
const CHATS_PAGE_SIZE = 50;
const FIRST_QUESTION_LENGTH = 160;

export const listChats = mcpTool({
  name: "list_chats",
  title: "List the reader's conversations",
  description: `List the conversations the reader had in the app about their overviews: questions they asked about a video, article or episode and the answers, which came only from the source. By overview, by project, or across the library; newest first, ${CHATS_PAGE_SIZE} a page. Each gives the conversation id, the overview, the first question, how many questions and when it was last added to. Read one with get_chat. Use them to know what the reader already asked, decided or was told before answering again.`,
  input: z.object({
    overview: z.string().optional().describe("Only conversations about this overview, by its id"),
    project: z.string().optional().describe("Only conversations about overviews in this project, by its name or id"),
    cursor: z.string().regex(/^\d+$/).optional().describe("Where to carry on from: the cursor the previous call ended with"),
  }),
  run: async ({ overview: overviewId, project: nameOrId, cursor }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    let overviewIds: string[] | undefined;
    if (overviewId !== undefined) {
      if (!library.entries.some((entry) => entry.overview.id === overviewId)) {
        return toolError(`There is no overview with id ${overviewId} in this library.`);
      }
      overviewIds = [overviewId];
    }
    if (nameOrId !== undefined) {
      const project = resolveProject(library, nameOrId);
      if (!isProject(project)) return project;
      const inProject: string[] = projectOverviews(library, project.id).map(({ overview }) => overview.id);
      overviewIds = overviewIds === undefined ? inProject : overviewIds.filter((id) => inProject.includes(id));
    }
    const titles = new Map<string, string>(library.entries.map(({ overview }) => [overview.id, overview.source.title]));
    const chats = (await readChats(sql, accountId, overviewIds))
      .filter((chat) => titles.has(chat.overviewId))
      .sort((left, right) => lastMessageAt(right).localeCompare(lastMessageAt(left)));
    if (chats.length === 0) {
      return {
        text:
          overviewIds === undefined
            ? "The reader has no conversations yet. They ask questions about an overview inside it, in the app."
            : "No conversations about these overviews.",
      };
    }
    const page = pageOf(chats, cursor, CHATS_PAGE_SIZE);
    const lines = page.items.map((chat) => {
      const first = chat.messages.find((message) => message.from === "reader")?.text ?? "";
      const question = first.length > FIRST_QUESTION_LENGTH ? `${first.slice(0, FIRST_QUESTION_LENGTH).trimEnd()}…` : first;
      const facts = [
        `about "${titles.get(chat.overviewId)}" (overview id ${chat.overviewId})`,
        `${chatQuestionCount(chat.messages)} question(s)`,
        `last ${lastMessageAt(chat).slice(0, 10)}`,
        `id ${chat.id}`,
      ];
      return `- "${question}"\n  ${facts.join(" · ")}`;
    });
    const footer = [
      ...(page.total > page.items.length
        ? [`These are conversations ${page.first + 1}–${page.first + page.items.length} of ${page.total}.`]
        : []),
      ...(page.next === null ? [] : [`More remain: call again with cursor "${page.next}".`]),
    ];
    return { text: [`${page.total} conversation(s).`, ...footer, "", ...lines].join("\n").trim() };
  },
});
