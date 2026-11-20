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
  z.object({ overviewId: OverviewId, title: z.string(), item: OverviewPartPlace.nullable() }).strict(),
]);
export type ChatCitation = z.infer<typeof ChatCitation>;
export type OtherOverviewCitation = Extract<ChatCitation, { overviewId: string }>;

export const MAX_CHAT_SOURCES = 200;

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
  }),
  // inSource is false when the source doesn't say. Another chat and the overview are never the
  // source: an answer resting only on the overview is "From the overview", read off its citations.
  z.object({
    from: z.literal("answer"),
    text: MessageText,
    at: z.iso.datetime(),
    citations: z.array(ChatCitation),
    inSource: z.boolean(),
  }),
]);
export type ChatMessage = z.infer<typeof ChatMessage>;

// One conversation about one overview. Its own record, never a field of the overview, which
// is replaced wholesale when it is made again (CLAUDE.md, the read and favourite lesson). The
// server writes it; a device only reads it or deletes it (docs/features/chats.md).
export const Chat = z.object({
  id: z.string().min(1),
  overviewId: OverviewId,
  startedAt: z.iso.datetime(),
  messages: z
    .array(ChatMessage)
    .min(1)
    .max(MAX_CHAT_QUESTIONS * 2),
});
export type Chat = z.infer<typeof Chat>;

// The overview comes first, so an overview's chats are found by the start of their ids.
export const chatRecordId = (overviewId: string, conversationId: string): string => `${overviewId}:${conversationId}`;

export const answeredFromOverview = (message: Pick<Extract<ChatMessage, { from: "answer" }>, "inSource" | "citations">): boolean =>
  !message.inSource && message.citations.some((citation) => "part" in citation);

export const answeredFromOtherOverviews = (message: Pick<Extract<ChatMessage, { from: "answer" }>, "citations">): boolean =>
  message.citations.some((citation) => "overviewId" in citation);

export const chatQuestionCount = (messages: readonly Pick<ChatMessage, "from">[]): number =>
  messages.filter((message) => message.from === "reader").length;
