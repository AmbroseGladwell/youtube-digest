import { z } from "zod";

const SourceRef = z.object({ id: z.string(), relation: z.string() });
const ListItem = z.object({ text: z.string(), sources: z.array(z.string()) });

// Why every scope shares this shape: docs/features/chats.md, "One shape for every answer".
export const ChatReply = z.object({
  intro: z.string(),
  introSources: z.array(SourceRef),
  sections: z.array(
    z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()),
      numbered: z.array(ListItem),
      bullets: z.array(ListItem),
      sources: z.array(SourceRef),
    }),
  ),
  takeaway: z.string(),
  inSource: z.boolean(),
  generalKnowledge: z.boolean(),
});
export type ChatReply = z.infer<typeof ChatReply>;
export type ChatReplySection = ChatReply["sections"][number];

const SOURCE_REF = {
  type: "object",
  additionalProperties: false,
  required: ["id", "relation"],
  properties: { id: { type: "string" }, relation: { type: "string" } },
} as const;

const LIST_ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["text", "sources"],
  properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
} as const;

// Why intro comes first: docs/features/chats.md, "One shape for every answer".
export const CHAT_REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intro", "introSources", "sections", "takeaway", "inSource", "generalKnowledge"],
  properties: {
    intro: { type: "string" },
    introSources: { type: "array", items: SOURCE_REF },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "paragraphs", "numbered", "bullets", "sources"],
        properties: {
          heading: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          numbered: { type: "array", items: LIST_ITEM },
          bullets: { type: "array", items: LIST_ITEM },
          sources: { type: "array", items: SOURCE_REF },
        },
      },
    },
    takeaway: { type: "string" },
    inSource: { type: "boolean" },
    generalKnowledge: { type: "boolean" },
  },
} as const;

export interface CitedIds {
  passages: string[];
  overviewParts: string[];
  chatMessages: string[];
  inSource: boolean;
}

const TRANSCRIPT_PASSAGE_ID = /^(S\d+\.)?p\d+$/;
const CHAT_MESSAGE_ID = /^c\d+\.m\d+$/;

export const citedIds = (ids: readonly string[], inSource: boolean): CitedIds => {
  const unique = [...new Set(ids)];
  return {
    passages: unique.filter((id) => TRANSCRIPT_PASSAGE_ID.test(id)),
    chatMessages: unique.filter((id) => CHAT_MESSAGE_ID.test(id)),
    overviewParts: unique.filter((id) => !TRANSCRIPT_PASSAGE_ID.test(id) && !CHAT_MESSAGE_ID.test(id)),
    inSource,
  };
};

export const allIds = (reply: ChatReply): string[] => [
  ...reply.introSources.map((source) => source.id),
  ...reply.sections.flatMap((section) => [
    ...section.sources.map((source) => source.id),
    ...[...section.numbered, ...section.bullets].flatMap((item) => item.sources),
  ]),
];

export const ANSWER_SHAPE_RULES = `Answer in this shape, structured only where it helps:
- intro: the answer itself. A simple question is answered by the intro alone, in two to five plain sentences: leave sections empty and takeaway empty, and list in introSources the ids it rests on.
- sections: only when the question has parts, or the answer compares or lists several things. Each has a short heading, one or two short paragraphs, a numbered list where order matters or bullets where it doesn't (otherwise leave both empty), and sources: every id the section rests on.
- A source's relation is empty when it backs the section. Only where the section compares, give the side that source takes in one to four words, such as "For charging early".
- A list item that names or rests on a source lists its ids in the item's own sources, so each item can be followed; the section's sources still list every id.
- When sources disagree, give that a section of its own.
- takeaway: one sentence when there are sections; otherwise empty.
- Never write an id in the text: the sources carry them.
- Never use an em dash (—) anywhere; use a comma or a full stop instead.
- Light Markdown is allowed in the text, never in a heading: **bold** for a few key words (never a whole sentence), *italics*, \`inline code\` for a command, file, setting or piece of code, and a fenced code block with its language (\`\`\`python) when the answer needs code. A [link](https://…) only to an address the source or an overview gives. No headings, tables or HTML in the text: lists go in numbered and bullets.`;
