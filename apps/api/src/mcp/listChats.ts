import { z } from "zod";
import { chatOwner, chatQuestionCount, type Chat } from "@overview/domain";
import { mcpTool, toolError } from "./McpTool.js";
import { pageOf } from "./pageOf.js";
import { projectOverviews } from "./projectOverviews.js";
import { lastMessageAt, readChats } from "./readChats.js";
import { readLibrary } from "./readLibrary.js";
import { isProject, resolveProject } from "./resolveProject.js";

// As a listing of overviews pages (docs/features/mcp-connector.md, "The context budget").
const CHATS_PAGE_SIZE = 50;
const FIRST_QUESTION_LENGTH = 160;

const noChatsText = (filtered: boolean, onlyLibrary: boolean): string => {
  if (!filtered) {
    return "The reader has no conversations yet. They ask questions about an overview inside it, on a project's page or over their library, in the app.";
  }
  if (onlyLibrary) {
    return "No conversations over the whole library.";
  }
  return "No conversations about these overviews.";
};

export const listChats = mcpTool({
  name: "list_chats",
  title: "List the reader's conversations",
  description: `List the conversations the reader had in the app: about one overview (a video, article or episode, answered from the source, or saying it doesn't and adding general knowledge), on a project's page, or over their whole library (answered in sections from their overviews). By overview, by project, or across the library; newest first, ${CHATS_PAGE_SIZE} a page. Each gives the conversation id, what it was about, the first question, how many questions and when it was last added to. Read one with get_chat. Use them to know what the reader already asked, decided or was told before answering again.`,
  input: z.object({
    overview: z.string().optional().describe("Only conversations about this overview, by its id"),
    project: z.string().optional().describe("Only conversations on this project's page or about overviews in it, by its name or id"),
    library: z.boolean().optional().describe("true for only the conversations over the whole library"),
    cursor: z.string().regex(/^\d+$/).optional().describe("Where to carry on from: the cursor the previous call ended with"),
  }),
  run: async ({ overview: overviewId, project: nameOrId, library: overLibrary, cursor }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const filtered = overviewId !== undefined || nameOrId !== undefined || overLibrary === true;
    let wanted: (chat: Chat) => boolean = () => true;
    if (overviewId !== undefined) {
      if (!library.entries.some((entry) => entry.overview.id === overviewId)) {
        return toolError(`There is no overview with id ${overviewId} in this library.`);
      }
      wanted = (chat) => chat.overviewId === overviewId;
    }
    if (nameOrId !== undefined) {
      const project = resolveProject(library, nameOrId);
      if (!isProject(project)) {
        return project;
      }
      const inProject = new Set<string>(projectOverviews(library, project.id).map(({ overview }) => overview.id));
      const before = wanted;
      wanted = (chat) =>
        before(chat) && (chat.projectId === project.id || (chat.overviewId !== undefined && inProject.has(chat.overviewId)));
    }
    if (overLibrary === true) {
      const before = wanted;
      wanted = (chat) => before(chat) && chatOwner(chat).kind === "library";
    }
    const titles = new Map<string, string>(library.entries.map(({ overview }) => [overview.id, overview.source.title]));
    const projectNames = new Map<string, string>(library.projects.map((project) => [project.id, project.name]));
    const held = (chat: Chat) => {
      const owner = chatOwner(chat);
      return owner.kind === "library" || (owner.kind === "overview" ? titles.has(owner.id) : projectNames.has(owner.id));
    };
    const chats = (await readChats(sql, accountId))
      .filter((chat) => held(chat) && wanted(chat))
      .sort((left, right) => lastMessageAt(right).localeCompare(lastMessageAt(left)));
    if (chats.length === 0) {
      return {
        text: noChatsText(filtered, overLibrary === true && overviewId === undefined && nameOrId === undefined),
      };
    }
    const about = (chat: Chat): string => {
      const owner = chatOwner(chat);
      if (owner.kind === "overview") {
        return `about "${titles.get(owner.id)}" (overview id ${owner.id})`;
      }
      if (owner.kind === "project") {
        return `on the project "${projectNames.get(owner.id)}" (project id ${owner.id})`;
      }
      return "over the whole library";
    };
    const page = pageOf(chats, cursor, CHATS_PAGE_SIZE);
    const lines = page.items.map((chat) => {
      const first = chat.messages.find((message) => message.from === "reader")?.text ?? "";
      const question = first.length > FIRST_QUESTION_LENGTH ? `${first.slice(0, FIRST_QUESTION_LENGTH).trimEnd()}…` : first;
      const facts = [
        about(chat),
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
