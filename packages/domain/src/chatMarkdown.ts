import {
  answeredFromOtherOverviews,
  answeredFromOverview,
  type Chat,
  type ChatAnswerSections,
  type ChatCitation,
  type ChatListItem,
  type OtherOverviewCitation,
  relationLabel,
} from "./Chat.js";
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
  if ("overviewId" in citation) return otherOverviewText(citation);
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

// Named by the title it had when cited, which outlives the overview; its item by the section and place
// it had then.
function otherOverviewText({ overviewId, title, item, range }: OtherOverviewCitation): string {
  const named = `the reader's overview "${title}" (${overviewId})`;
  if (range !== undefined) return `${formatTimestamp(range.startMs)}–${formatTimestamp(range.endMs)} of ${named}`;
  if (item === null) return named;
  return SINGLE_ITEM_PARTS.has(item.part)
    ? `"${PART_SECTION[item.part]}" of ${named}`
    : `item ${item.index + 1} of "${PART_SECTION[item.part]}" in ${named}`;
}

// An article or a recipe page is answered from its overview alone, so only a decline is noted.
const answerNote = (message: Extract<Chat["messages"][number], { from: "answer" }>, kind: ChatSourceKind): string | null => {
  if (message.inSource) return null;
  if (!answeredFromOverview(message) && answeredFromOtherOverviews(message)) {
    return `Answered from the reader's other overviews, not from what the ${answeredFromOverviewAlone(kind) ? "overview of this " + kind : kind} says.`;
  }
  if (answeredFromOverviewAlone(kind)) {
    return answeredFromOverview(message)
      ? null
      : `${kind === "recipe" ? "The recipe" : "The overview of this article"} doesn't cover this; anything the answer adds is general knowledge, not from it.`;
  }
  return answeredFromOverview(message)
    ? `Answered from the overview, not from what the ${kind} says.`
    : `The ${kind} doesn't cover this; anything the answer adds is general knowledge, not from the ${kind}.`;
};

// What a library or project chat was over, for its heading (OV-353).
export type ChatScopeLabel = { kind: "project"; name: string; id: string } | { kind: "library" };

// Sources grouped by how they relate, each group named once: "Based on: …; For charging early: …".
const sourcesLine = (sources: ChatAnswerSections["introSources"], describe: (citation: ChatCitation) => string): string | null => {
  if (sources.length === 0) return null;
  const groups = new Map<string, string[]>();
  for (const { citation, relation } of sources) {
    const label = relationLabel(relation);
    groups.set(label, [...(groups.get(label) ?? []), describe(citation)]);
  }
  return [...groups].map(([relation, cited]) => `${relation}: ${cited.join("; ")}`).join(" · ");
};

const listItemText = (item: ChatListItem, describe: (citation: ChatCitation) => string): string =>
  item.sources.length === 0 ? item.text : `${item.text} (${item.sources.map(describe).join("; ")})`;

// A structured answer as it reads outside the app: the intro, each section's heading, paragraphs
// and lists with its sources by how they relate, then the takeaway (OV-354).
function sectionsText(sections: ChatAnswerSections, describe: (citation: ChatCitation) => string): string {
  const introSources = sourcesLine(sections.introSources, describe);
  const body = sections.sections.flatMap((section, index) => {
    const sources = sourcesLine(section.sources, describe);
    return [
      `   ${index + 1}. ${section.heading}`,
      ...section.paragraphs.map((paragraph) => `      ${paragraph}`),
      ...section.numbered.map((item, at) => `      ${at + 1}) ${listItemText(item, describe)}`),
      ...section.bullets.map((item) => `      - ${listItemText(item, describe)}`),
      ...(sources === null ? [] : [`      (${sources})`]),
    ];
  });
  return [sections.intro, ...(introSources === null ? [] : [`   (${introSources})`]), ...body, sections.takeaway]
    .filter((line) => line.trim() !== "")
    .join("\n");
}

const scopedCitation = (citation: ChatCitation): string =>
  "overviewId" in citation ? otherOverviewText(citation) : "a place in the overview";

function scopedChatMarkdown(chat: Chat, scope: ChatScopeLabel, from: number, count: number): string {
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const said =
      message.from === "answer" && message.sections !== undefined ? sectionsText(message.sections, scopedCitation) : message.text;
    return `${index + 1}. **${message.from === "reader" ? "The reader asked" : "The answer"}** (${message.at.slice(0, 10)}): ${said}`;
  });
  const over = scope.kind === "library" ? "the reader's whole library" : `the reader's project "${scope.name}"`;
  return [
    `# A conversation over ${over}`,
    `Conversation id: ${chat.id}${scope.kind === "project" ? ` · project id ${scope.id}` : ""} · started ${chat.startedAt.slice(0, 10)} · ${chat.messages.length} messages`,
    "",
    `Answers come from the overviews in ${over}, each section naming the overviews it rests on and how; where an answer connects them, the connection is the answer's, not theirs.`,
    "",
    ...lines,
  ].join("\n");
}

// A conversation as it reads outside the app: each question, each answer with where it found
// what it says, and a plain flag on an answer the source didn't cover
// (docs/features/mcp-connector.md, "Chats").
export function chatMarkdown(chat: Chat, about: Overview | ChatScopeLabel, { from = 0, count = chat.messages.length } = {}): string {
  if (!("source" in about)) return scopedChatMarkdown(chat, about, from, count);
  const overview = about;
  const kind = chatSourceKind(overview);
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const said =
      message.from === "answer" && message.sections !== undefined
        ? sectionsText(message.sections, (citation) => citationText(overview, citation))
        : message.text;
    const head = `${index + 1}. **${message.from === "reader" ? "The reader asked" : "The answer"}** (${message.at.slice(0, 10)}): ${said}`;
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
      ? `Answers come from the overview of this ${kind === "recipe" ? "recipe page and its recipe" : "article"}, not from the page itself, whose text isn't kept. Where it doesn't cover a question, an answer may add general knowledge, marked as not from it; another conversation cited is context.`
      : "Answers come from the reader's own copy of the source and its overview. Where the source doesn't cover a question, an answer may add general knowledge, marked as not from the source; the overview and another conversation cited are context, never the source.",
    "",
    ...lines,
  ].join("\n");
}
