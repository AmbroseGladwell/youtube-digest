import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";
import { OVERVIEW_PARTS } from "./overviewParts.js";

export const MAX_CHAT_QUESTIONS = 50;
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;

const OverviewPartPlace = z
  .object({
    part: z.enum(OVERVIEW_PARTS),
    index: z.number().int().nonnegative(),
    textHash: z.string().regex(/^[0-9a-f]{8}$/),
  })
  .strict();

const OtherOverviewCitationPlace = z
  .object({
    overviewId: OverviewId,
    title: z.string(),
    item: OverviewPartPlace.nullable(),
    // A minute of that overview's own source, from a keyword passage it was shown (OV-352).
    range: z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative() }).strict().optional(),
  })
  .strict();

// Where an answer found what it says, worked out by code from the ids the model cited, never
// stated by the model: a stretch of a video or episode, a paragraph of an article, a message in
// another chat about the same overview, an item of the overview itself, with a hash of its
// text so a regenerated overview can tell whether it still holds it, or another of the reader's
// overviews, or an item of it (OV-355). Another overview's title is copied in by code, so the
// citation still names it once that overview is deleted (docs/features/chats.md;
// CLAUDE.md, "Never let a model count, measure or time anything").
export const ChatCitation = z.union([
  z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative() }).strict(),
  z.object({ paragraph: z.number().int().nonnegative() }).strict(),
  z.object({ chatId: z.string().min(1), message: z.number().int().nonnegative() }).strict(),
  OverviewPartPlace,
  OtherOverviewCitationPlace,
]);
export type ChatCitation = z.infer<typeof ChatCitation>;
export type OtherOverviewCitation = Extract<ChatCitation, { overviewId: string }>;

export const MAX_SOURCE_RELATION_LENGTH = 40;

// Every chat's answer, structured where it helps, whatever its scope (OV-354, page 4; owner, 21
// Nov 2026): an intro, which alone answers a simple question, then sections, each a bold heading,
// short paragraphs, a numbered list where order matters and bullets where it doesn't, and
// underneath, everything it draws on with how it relates (backing it, or the side it takes when it
// compares), then a takeaway. A list item names its own sources, so a list of overviews has a chip
// after each (OV-362). Every source is cited by code from the ids the model gave
// (docs/features/chats.md, "One shape for every answer").
const ChatSourceRelation = z.object({ citation: ChatCitation, relation: z.string().max(MAX_SOURCE_RELATION_LENGTH) });

export const ChatListItem = z.object({ text: z.string(), sources: z.array(ChatCitation) });
export type ChatListItem = z.infer<typeof ChatListItem>;

export const ChatAnswerSection = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()),
  numbered: z.array(ChatListItem),
  bullets: z.array(ChatListItem),
  sources: z.array(ChatSourceRelation),
});
export type ChatAnswerSection = z.infer<typeof ChatAnswerSection>;

export const ChatAnswerSections = z.object({
  intro: z.string(),
  introSources: z.array(ChatSourceRelation),
  sections: z.array(ChatAnswerSection),
  takeaway: z.string(),
});
export type ChatAnswerSections = z.infer<typeof ChatAnswerSections>;

// What a section's sources are called when they back it rather than taking a side. Answers before
// OV-362 stored "Supports", which reads either way round, so it shows as this too.
export const BACKING_RELATION = "Based on";
export const relationLabel = (relation: string): string => (relation === "Supports" || relation === "" ? BACKING_RELATION : relation);

export const MAX_CHAT_SOURCES = 200;
export const MAX_CHAT_PICKS = 5;
export const MAX_CHAT_MINUTES = 24;

// What the question was asked over, counted by code when it was answered, never by the model.
export const ChatScopeStats = z.object({
  overviews: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative().optional(),
  // How many of them the answer read whole: "From 5 of your 208 overviews" (OV-354).
  read: z.number().int().nonnegative().optional(),
  // How many the plan's filters kept, for "Looked across 112 of your 223 overviews"; absent when whole.
  looked: z.number().int().nonnegative().optional(),
});
export type ChatScopeStats = z.infer<typeof ChatScopeStats>;

// Another of the reader's overviews that went into a conversation with a question: pinned by the
// reader with "@" (on its own or as part of a project) or found by search. Its label is fixed for
// the rest of the conversation, so each question rebuilds the earlier ones' sources exactly and the
// prompt only ever grows at its end (docs/features/chats.md, "Other overviews").
export const ChatSource = z.object({
  label: z.string().regex(/^S[1-9]\d*$/),
  overviewId: OverviewId,
  title: z.string(),
  how: z.enum(["pinned", "found"]),
  projectId: ProjectId.optional(),
  brief: z.boolean().optional(),
});
export type ChatSource = z.infer<typeof ChatSource>;

const MessageText = z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH);

export const ChatMessage = z.discriminatedUnion("from", [
  // sources went in with this question; setAside names the labels the reader took out with it.
  z.object({
    from: z.literal("reader"),
    text: MessageText,
    at: z.iso.datetime(),
    sources: z.array(ChatSource).max(MAX_CHAT_SOURCES).optional(),
    setAside: z.array(z.string()).max(MAX_CHAT_SOURCES).optional(),
    // A library or project chat: the overviews read whole for this question.
    picked: z.array(OverviewId).max(MAX_CHAT_PICKS).optional(),
    // False when the reader turned Search my library off for this question: only pins were read (OV-354).
    searchedLibrary: z.literal(false).optional(),
    // Minutes of other overviews' transcripts sent with this question, by passage id (OV-352).
    minutes: z
      .array(z.object({ overviewId: OverviewId, passages: z.array(z.string().regex(/^p[1-9]\d*$/)).max(MAX_CHAT_MINUTES) }))
      .max(MAX_CHAT_MINUTES)
      .optional(),
  }),
  // inSource is false when the source doesn't say. Another chat and the overview are never the
  // source: an answer resting only on the overview is "From the overview", read off its citations.
  z.object({
    from: z.literal("answer"),
    text: MessageText,
    at: z.iso.datetime(),
    citations: z.array(ChatCitation),
    inSource: z.boolean(),
    // A library or project chat's answer: text is its flattened reading, citations every point's.
    sections: ChatAnswerSections.optional(),
    stats: ChatScopeStats.optional(),
  }),
]);
export type ChatMessage = z.infer<typeof ChatMessage>;

// One conversation. Its owner is the overview or the project it belongs to, or neither for a chat
// over the whole library; the owner decides where it is listed and what it goes with (OV-353). A
// flat field each, never an owner object, because the device's index and the server's sweeps read
// the stored body as it is. Its own record, never a field of the overview, which is replaced
// wholesale when it is made again (CLAUDE.md, the read and favourite lesson). The server writes
// it; a device only reads it or deletes it (docs/features/chats.md).
export const Chat = z
  .object({
    id: z.string().min(1),
    overviewId: OverviewId.optional(),
    projectId: ProjectId.optional(),
    startedAt: z.iso.datetime(),
    messages: z
      .array(ChatMessage)
      .min(1)
      .max(MAX_CHAT_QUESTIONS * 2),
  })
  .refine((chat) => chat.overviewId === undefined || chat.projectId === undefined, { message: "a chat has at most one owner" });
export type Chat = z.infer<typeof Chat>;

export type ChatOwner = { kind: "overview"; id: string } | { kind: "project"; id: string } | { kind: "library" };

export const chatOwner = (chat: Pick<Chat, "overviewId" | "projectId">): ChatOwner => {
  if (chat.overviewId !== undefined) {
    return { kind: "overview", id: chat.overviewId };
  }
  if (chat.projectId !== undefined) {
    return { kind: "project", id: chat.projectId };
  }
  return { kind: "library" };
};

// An overview's chats start with its id, as they always have; a project's and the library's with
// a word no overview id can be, so each owner's chats are found by the start of their ids.
export const chatOwnerPrefix = (owner: ChatOwner): string => {
  if (owner.kind === "overview") {
    return `${owner.id}:`;
  }
  return owner.kind === "project" ? `project:${owner.id}:` : "library:";
};

export const chatRecordId = (owner: ChatOwner | string, conversationId: string): string =>
  `${chatOwnerPrefix(typeof owner === "string" ? { kind: "overview", id: owner } : owner)}${conversationId}`;

export const chatOwnerOfId = (id: string): ChatOwner | null => {
  const [first, second] = id.split(":");
  if (first === "library" && second !== undefined) {
    return { kind: "library" };
  }
  if (first === "project" && second !== undefined && id.split(":").length === 3) {
    return { kind: "project", id: second };
  }
  return first !== undefined && second !== undefined && id.split(":").length === 2 ? { kind: "overview", id: first } : null;
};

export const chatConversationId = (id: string): string => id.slice(id.lastIndexOf(":") + 1);

export const answeredFromOverview = (message: Pick<Extract<ChatMessage, { from: "answer" }>, "inSource" | "citations">): boolean =>
  !message.inSource && message.citations.some((citation) => "part" in citation);

export const answeredFromOtherOverviews = (message: Pick<Extract<ChatMessage, { from: "answer" }>, "citations">): boolean =>
  message.citations.some((citation) => "overviewId" in citation);

export const chatQuestionCount = (messages: readonly Pick<ChatMessage, "from">[]): number =>
  messages.filter((message) => message.from === "reader").length;
