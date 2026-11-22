import type { Chat } from "./Chat.js";
import { chatMarkdown } from "./chatMarkdown.js";
import type { Overview } from "./Overview.js";
import { overviewMarkdown } from "./overviewMarkdown.js";

export const CONNECTED_CHAT_INSTRUCTION =
  "Use The Overview to carry on this conversation. Read the overview with get_overview and the conversation with get_chat, " +
  "and if you need more than they say, read its transcript with get_transcript rather than searching the web. Cite the overview's timestamps.";

// Connected, it names what to read with get_chat: docs/features/chats.md.
export const chatHandOffPrompt = (chat: Chat, overview: Overview, connected: boolean): string => {
  return connected
    ? `${CONNECTED_CHAT_INSTRUCTION}\n<overview>${overview.source.title} (The Overview id ${overview.id})</overview>\n<conversation>${chat.id}</conversation>`
    : `Carry on this conversation about the overview below.\n\n<overview>\n${overviewMarkdown({ ...overview, followUpQuestions: null })}</overview>\n\n<conversation>\n${chatMarkdown(chat, overview)}\n</conversation>`;
};
