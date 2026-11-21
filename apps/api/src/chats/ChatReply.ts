import { z } from "zod";

const SourceRef = z.object({ id: z.string(), relation: z.string() });

// Every chat's reply, whatever its scope (OV-354; owner, 21 Nov 2026): an intro that alone answers a
// simple question, sections only where they help, a takeaway, and every source as an id with how it
// relates. inSource and generalKnowledge are an overview chat's; a library chat sets them false.
export const ChatReply = z.object({
  intro: z.string(),
  introSources: z.array(SourceRef),
  sections: z.array(
    z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()),
      numbered: z.array(z.string()),
      bullets: z.array(z.string()),
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

// intro first, so its text can be streamed while the sections are still to come; each section
// arrives whole.
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
          numbered: { type: "array", items: { type: "string" } },
          bullets: { type: "array", items: { type: "string" } },
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

// The ids a reply cites, by kind, as code turns them into places: transcript passages (p12, and
// another overview's minutes, S2.p14), other chats' messages (c1.m3), and everything else an item of
// an overview (step2, S2.kp1, O3).
export function citedIds(ids: readonly string[], inSource: boolean): CitedIds {
  const unique = [...new Set(ids)];
  return {
    passages: unique.filter((id) => /^(S\d+\.)?p\d+$/.test(id)),
    chatMessages: unique.filter((id) => /^c\d+\.m\d+$/.test(id)),
    overviewParts: unique.filter((id) => !/^(S\d+\.)?p\d+$/.test(id) && !/^c\d+\.m\d+$/.test(id)),
    inSource,
  };
}

export const allIds = (reply: ChatReply): string[] => [
  ...reply.introSources.map((source) => source.id),
  ...reply.sections.flatMap((section) => section.sources.map((source) => source.id)),
];

// The shape every chat's prompt asks for, the same whatever its scope.
export const ANSWER_SHAPE_RULES = `Answer in this shape, structured only where it helps:
- intro: the answer itself. A simple question is answered by the intro alone, in two to five plain sentences: leave sections empty and takeaway empty, and list in introSources the ids it rests on.
- sections: only when the question has parts, or the answer compares or lists several things. Each has a short heading, one or two short paragraphs, a numbered list where order matters or bullets where it doesn't (otherwise leave both empty), and sources: every id the section rests on, each with its relation, "Supports", or where the section compares, a few words naming the side that source takes.
- When sources disagree, give that a section of its own.
- takeaway: one sentence when there are sections; otherwise empty.
- Never write an id in the text: the sources carry them.`;
