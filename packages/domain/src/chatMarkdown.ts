import { answeredFromOverview, type Chat, type ChatCitation } from "./Chat.js";
import { formatTimestamp } from "./formatTimestamp.js";
import type { Overview } from "./Overview.js";
import { answeredFromOverviewAlone, chatSourceKind, type ChatSourceKind } from "./chatSourceKind.js";
import { citedOverviewPart, type OverviewPart } from "./overviewParts.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

// A stretch links into the video, as an overview's moments do; an episode's time is plain text,
// since a link into its audio would land wherever that listen's ads put it
// (docs/features/podcast-notes.md, "Times and the episode's audio").
function citationText(overview: Overview, citation: ChatCitation): string {
  if ("chatId" in citation) return `message ${citation.message + 1} of conversation ${citation.chatId}`;
  if ("paragraph" in citation) return `paragraph ${citation.paragraph + 1} of the article`;
  if ("part" in citation) return overviewPartText(overview, citation);
  const label = `${formatTimestamp(citation.startMs)}–${formatTimestamp(citation.endMs)}`;
  return overview.source.kind === "youtube" ? `[${label}](${youtubeTimestampUrl(overview.source.url, citation.startMs)})` : label;
}

const PART_SECTION: Record<OverviewPart, string> = {
  verdict: "Verdict",
  dubiousClaim: "Why it is dubious",
  keyPoint: "Key points",
  step: "The steps it gives",
  howToApply: "How to apply",
  selling: "What it sells",
  watchAnyway: "Watch it anyway?",
  ingredient: "Ingredients",
  method: "Method",
  chapter: "Chapters",
};

const SINGLE_ITEM_PARTS: ReadonlySet<OverviewPart> = new Set(["verdict", "selling", "watchAnyway"]);

function overviewPartText(overview: Overview, citation: Extract<ChatCitation, { part: OverviewPart }>): string {
  const section =
    citation.part !== "watchAnyway"
      ? PART_SECTION[citation.part]
      : overview.source.kind === "podcast"
        ? "Listen to it anyway?"
        : overview.source.kind === "web"
          ? "Read it anyway?"
          : PART_SECTION.watchAnyway;
  const cited = citedOverviewPart(overview, citation);
  if (cited === null) return `the overview's "${section}", no longer in it`;
  if (cited.index === null) return `the overview's "${section}", an item since changed`;
  return SINGLE_ITEM_PARTS.has(cited.part) ? `the overview's "${section}"` : `item ${cited.index + 1} of the overview's "${section}"`;
}

// An article or a recipe page is answered from its overview alone, so only a decline is noted.
const answerNote = (message: Extract<Chat["messages"][number], { from: "answer" }>, kind: ChatSourceKind): string | null => {
  if (message.inSource) return null;
  if (answeredFromOverviewAlone(kind)) {
    return answeredFromOverview(message)
      ? null
      : `${kind === "recipe" ? "The recipe" : "The overview of this article"} doesn't cover this; the answer says so rather than guessing.`;
  }
  return answeredFromOverview(message)
    ? `Answered from the overview, not from what the ${kind} says.`
    : `The ${kind} doesn't cover this; the answer says so rather than guessing.`;
};

// A conversation as it reads outside the app: each question, each answer with where it found
// what it says, and a plain flag on an answer the source didn't cover
// (docs/features/mcp-connector.md, "Chats").
export function chatMarkdown(chat: Chat, overview: Overview, { from = 0, count = chat.messages.length } = {}): string {
  const kind = chatSourceKind(overview);
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const head = `${index + 1}. **${message.from === "reader" ? "The reader asked" : "The answer"}** (${message.at.slice(0, 10)}): ${message.text}`;
    if (message.from === "reader") return head;
    const notes = [
      answerNote(message, kind),
      message.citations.length === 0 ? null : `Cites: ${message.citations.map((citation) => citationText(overview, citation)).join("; ")}.`,
    ].filter((note) => note !== null);
    return [head, ...notes.map((note) => `   ${note}`)].join("\n");
  });
  return [
    `# A conversation about "${overview.source.title}"`,
    `Conversation id: ${chat.id} · overview id ${overview.id} · started ${chat.startedAt.slice(0, 10)} · ${chat.messages.length} messages`,
    "",
    answeredFromOverviewAlone(kind)
      ? `Answers come only from the overview of this ${kind === "recipe" ? "recipe page and its recipe" : "article"}, not from the page itself, whose text isn't kept; another conversation cited is context.`
      : "Answers come only from the reader's own copy of the source and its overview; the overview and another conversation cited are context, never the source.",
    "",
    ...lines,
  ].join("\n");
}
