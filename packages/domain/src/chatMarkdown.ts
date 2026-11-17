import type { Chat, ChatCitation } from "./Chat.js";
import { formatTimestamp } from "./formatTimestamp.js";
import type { Overview } from "./Overview.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

// A stretch links into the video, as an overview's moments do; an episode's time is plain text,
// since a link into its audio would land wherever that listen's ads put it
// (docs/features/podcast-notes.md, "Times and the episode's audio").
function citationText(overview: Overview, citation: ChatCitation): string {
  if ("chatId" in citation) return `message ${citation.message + 1} of conversation ${citation.chatId}`;
  if ("paragraph" in citation) return `paragraph ${citation.paragraph + 1} of the article`;
  const label = `${formatTimestamp(citation.startMs)}–${formatTimestamp(citation.endMs)}`;
  return overview.source.kind === "youtube" ? `[${label}](${youtubeTimestampUrl(overview.source.url, citation.startMs)})` : label;
}

// A conversation as it reads outside the app: each question, each answer with where it found
// what it says, and a plain flag on an answer the source didn't cover
// (docs/features/mcp-connector.md, "Chats").
export function chatMarkdown(chat: Chat, overview: Overview, { from = 0, count = chat.messages.length } = {}): string {
  const kind = overview.source.kind === "podcast" ? "episode" : overview.source.kind === "web" ? "article" : "video";
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const head = `${index + 1}. **${message.from === "reader" ? "The reader asked" : "The answer"}** (${message.at.slice(0, 10)}): ${message.text}`;
    if (message.from === "reader") return head;
    const notes = [
      message.inSource ? null : `The ${kind} doesn't cover this; the answer says so rather than guessing.`,
      message.citations.length === 0 ? null : `Cites: ${message.citations.map((citation) => citationText(overview, citation)).join("; ")}.`,
    ].filter((note) => note !== null);
    return [head, ...notes.map((note) => `   ${note}`)].join("\n");
  });
  return [
    `# A conversation about "${overview.source.title}"`,
    `Conversation id: ${chat.id} · overview id ${overview.id} · started ${chat.startedAt.slice(0, 10)} · ${chat.messages.length} messages`,
    "",
    "Answers come only from the reader's own copy of the source; another conversation cited is context, never the source.",
    "",
    ...lines,
  ].join("\n");
}
