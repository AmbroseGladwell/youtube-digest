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
import { answerBlocks } from "./answerBlocks.js";
import { formatTimestamp } from "./formatTimestamp.js";
import type { Overview } from "./Overview.js";
import { answeredFromOverviewAlone, chatSourceKind, type ChatSourceKind } from "./chatSourceKind.js";
import { citedOverviewPart, type OverviewPart } from "./overviewParts.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

// A stretch links into the video, as an overview's moments do; an episode's time is plain text,
// since a link into its audio would land wherever that listen's ads put it
// (docs/features/podcast-notes.md, "Times and the episode's audio").
const citationText = (overview: Overview, citation: ChatCitation): string => {
  if ("chatId" in citation) {
    return `message ${citation.message + 1} of conversation ${citation.chatId}`;
  }
  if ("paragraph" in citation) {
    return `paragraph ${citation.paragraph + 1} of the article`;
  }
  if ("part" in citation) {
    return overviewPartText(overview, citation);
  }
  if ("overviewId" in citation) {
    return otherOverviewText(citation);
  }
  const label = `${formatTimestamp(citation.startMs)}–${formatTimestamp(citation.endMs)}`;
  return overview.source.kind === "youtube" ? `[${label}](${youtubeTimestampUrl(overview.source.url, citation.startMs)})` : label;
};

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

const sectionOf = (overview: Overview, part: OverviewPart): string => {
  if (part !== "watchAnyway") {
    return PART_SECTION[part];
  }
  if (overview.source.kind === "podcast") {
    return "Listen to it anyway?";
  }
  return overview.source.kind === "web" ? "Read it anyway?" : PART_SECTION.watchAnyway;
};

const overviewPartText = (overview: Overview, citation: Extract<ChatCitation, { part: OverviewPart }>): string => {
  const section = sectionOf(overview, citation.part);
  const cited = citedOverviewPart(overview, citation);
  if (cited === null) {
    return `the overview's "${section}", no longer in it`;
  }
  if (cited.index === null) {
    return `the overview's "${section}", an item since changed`;
  }
  return SINGLE_ITEM_PARTS.has(cited.part) ? `the overview's "${section}"` : `item ${cited.index + 1} of the overview's "${section}"`;
};

// Named by the title it had when cited, which outlives the overview; its item by the section and place
// it had then.
const otherOverviewText = ({ overviewId, title, item, range }: OtherOverviewCitation): string => {
  const named = `the reader's overview "${title}" (${overviewId})`;
  if (range !== undefined) {
    return `${formatTimestamp(range.startMs)}–${formatTimestamp(range.endMs)} of ${named}`;
  }
  if (item === null) {
    return named;
  }
  return SINGLE_ITEM_PARTS.has(item.part)
    ? `"${PART_SECTION[item.part]}" of ${named}`
    : `item ${item.index + 1} of "${PART_SECTION[item.part]}" in ${named}`;
};

// An article or a recipe page is answered from its overview alone, so only a decline is noted.
const answerNote = (message: Extract<Chat["messages"][number], { from: "answer" }>, kind: ChatSourceKind): string | null => {
  if (message.inSource) {
    return null;
  }
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
  if (sources.length === 0) {
    return null;
  }
  const groups = new Map<string, string[]>();
  for (const { citation, relation } of sources) {
    const label = relationLabel(relation);
    groups.set(label, [...(groups.get(label) ?? []), describe(citation)]);
  }
  return [...groups].map(([relation, cited]) => `${relation}: ${cited.join("; ")}`).join(" · ");
};

// Text inside a list item whose content starts `indent` columns in: each paragraph and fenced code
// block on lines of its own, every line after the first indented so it stays in the item (OV-374).
const nestedLines = (text: string, indent: number): string[] => {
  const lines = answerBlocks(text).flatMap((block) =>
    block.kind === "paragraph" ? [block.text] : ["```" + block.language, ...block.code.split("\n"), "```"],
  );
  return lines.map((line, at) => (at === 0 || line === "" ? line : " ".repeat(indent) + line));
};

const nestedText = (text: string, indent: number): string => nestedLines(text, indent).join("\n");

const endsInCode = (text: string): boolean => answerBlocks(text).at(-1)?.kind === "code";

const listItemText = (item: ChatListItem, describe: (citation: ChatCitation) => string, indent: number): string => {
  if (item.sources.length === 0) {
    return nestedText(item.text, indent);
  }
  const sources = `(${item.sources.map(describe).join("; ")})`;
  return endsInCode(item.text)
    ? `${nestedText(item.text, indent)}\n${" ".repeat(indent)}${sources}`
    : `${nestedText(item.text, indent)} ${sources}`;
};

// Where a message's text starts, after its "12. " in the conversation's list.
const messageIndent = (index: number): number => `${index + 1}. `.length;

// A structured answer as it reads outside the app: the intro, each section's heading, paragraphs
// and lists with its sources by how they relate, then the takeaway (OV-354), all inside the
// message's item in the conversation's list, starting `indent` columns in.
const sectionsText = (sections: ChatAnswerSections, describe: (citation: ChatCitation) => string, indent: number): string => {
  const pad = " ".repeat(indent);
  const introSources = sourcesLine(sections.introSources, describe);
  const body = sections.sections.flatMap((section, index) => {
    const sources = sourcesLine(section.sources, describe);
    const heading = `${pad}${index + 1}. `;
    const inSection = " ".repeat(heading.length);
    return [
      `${heading}${section.heading}`,
      ...section.paragraphs.map((paragraph) => `${inSection}${nestedText(paragraph, inSection.length)}`),
      ...section.numbered.map((item, at) => {
        const marker = `${inSection}${at + 1}) `;
        return `${marker}${listItemText(item, describe, marker.length)}`;
      }),
      ...section.bullets.map((item) => `${inSection}- ${listItemText(item, describe, inSection.length + 2)}`),
      ...(sources === null ? [] : [`${inSection}(${sources})`]),
    ];
  });
  const opening = [nestedText(sections.intro, indent), ...(introSources === null ? [] : [`${pad}(${introSources})`]), ...body].filter(
    (line) => line.trim() !== "",
  );
  // A blank line ends the last section's list, so the takeaway reads as the answer's own closing line.
  return sections.takeaway.trim() === ""
    ? opening.join("\n")
    : [...opening, "", `${pad}${nestedText(sections.takeaway, indent)}`].join("\n");
};

const scopedCitation = (citation: ChatCitation): string =>
  "overviewId" in citation ? otherOverviewText(citation) : "a place in the overview";

const scopedChatMarkdown = (chat: Chat, scope: ChatScopeLabel, from: number, count: number): string => {
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const indent = messageIndent(index);
    const said =
      message.from === "answer" && message.sections !== undefined
        ? sectionsText(message.sections, scopedCitation, indent)
        : nestedText(message.text, indent);
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
};

// A conversation as it reads outside the app: each question, each answer with where it found
// what it says, and a plain flag on an answer the source didn't cover
// (docs/features/mcp-connector.md, "Chats").
export const chatMarkdown = (chat: Chat, about: Overview | ChatScopeLabel, { from = 0, count = chat.messages.length } = {}): string => {
  if (!("source" in about)) {
    return scopedChatMarkdown(chat, about, from, count);
  }
  const overview = about;
  const kind = chatSourceKind(overview);
  const lines = chat.messages.slice(from, from + count).map((message, offset) => {
    const index = from + offset;
    const indent = messageIndent(index);
    const said =
      message.from === "answer" && message.sections !== undefined
        ? sectionsText(message.sections, (citation) => citationText(overview, citation), indent)
        : nestedText(message.text, indent);
    const head = `${index + 1}. **${message.from === "reader" ? "The reader asked" : "The answer"}** (${message.at.slice(0, 10)}): ${said}`;
    if (message.from === "reader") {
      return head;
    }
    const notes = [
      answerNote(message, kind),
      message.citations.length === 0 ? null : `Cites: ${message.citations.map((citation) => citationText(overview, citation)).join("; ")}.`,
    ].filter((note) => note !== null);
    return [head, ...notes.map((note) => `${" ".repeat(indent)}${note}`)].join("\n");
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
};
