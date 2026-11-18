import { z } from "zod";
import { chatMarkdown } from "@overview/domain";
import { mcpTool, toolError } from "./McpTool.js";
import { pageOf } from "./pageOf.js";
import { readChats } from "./readChats.js";
import { readLibrary } from "./readLibrary.js";

// Ten questions and their answers: a question holds up to 2,000 characters and an answer about
// 4,000, so a page stays under the 25,000 tokens Claude Code refuses past
// (docs/features/mcp-connector.md, "The context budget").
export const CHAT_PAGE_MESSAGES = 20;

export const getChat = mcpTool({
  name: "get_chat",
  title: "Read a conversation",
  description: `Read one conversation the reader had in the app about an overview, as Markdown: each question, each answer, and where each answer found what it says, as timestamp links into the video (times alone for an episode) or another conversation it built on. An answer the source didn't cover is marked, and anything it adds is general knowledge, not from the source. Cite these the way you cite an overview's moments. ${CHAT_PAGE_MESSAGES} messages a page, with a cursor.`,
  input: z.object({
    id: z.string().describe("The conversation's id, as list_chats or get_overview gives it"),
    cursor: z.string().regex(/^\d+$/).optional().describe("Where to carry on from: the cursor the previous call ended with"),
  }),
  run: async ({ id, cursor }, { sql, accountId }) => {
    const overviewId = id.split(":")[0] ?? "";
    const [library, chats] = await Promise.all([readLibrary(sql, accountId), readChats(sql, accountId, [overviewId])]);
    const chat = chats.find((candidate) => candidate.id === id);
    const entry = library.entries.find((candidate) => candidate.overview.id === overviewId);
    if (chat === undefined || entry === undefined) {
      return toolError(`There is no conversation with id ${id} in this library. list_chats names every conversation.`);
    }
    const page = pageOf(chat.messages, cursor, CHAT_PAGE_MESSAGES);
    const footer =
      page.next === null
        ? []
        : [
            `These are messages ${page.first + 1}–${page.first + page.items.length} of ${page.total}. More remain: call again with cursor "${page.next}".`,
          ];
    return {
      text: [chatMarkdown(chat, entry.overview, { from: page.first, count: CHAT_PAGE_MESSAGES }), ...footer].join("\n\n"),
      overviews: 1,
    };
  },
});
