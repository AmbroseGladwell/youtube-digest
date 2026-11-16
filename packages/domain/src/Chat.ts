import { z } from "zod";
import { OverviewId } from "./Brands.js";

export const MAX_CHAT_QUESTIONS = 30;
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;

// Where an answer found what it says, worked out by code from the passages the model cited,
// never stated by the model: a stretch of a video or episode, a paragraph of an article, or a
// message in another chat about the same overview (docs/features/chats.md; CLAUDE.md, "Never
// let a model count, measure or time anything").
export const ChatCitation = z.union([
  z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative() }).strict(),
  z.object({ paragraph: z.number().int().nonnegative() }).strict(),
  z.object({ chatId: z.string().min(1), message: z.number().int().nonnegative() }).strict(),
]);
export type ChatCitation = z.infer<typeof ChatCitation>;

const MessageText = z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH);

export const ChatMessage = z.discriminatedUnion("from", [
  z.object({ from: z.literal("reader"), text: MessageText, at: z.iso.datetime() }),
  // inSource is false when the source doesn't say, and the answer says so rather than guessing.
  // Another chat is never the source: an answer resting only on one is not inSource.
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

export const chatQuestionCount = (messages: readonly Pick<ChatMessage, "from">[]): number =>
  messages.filter((message) => message.from === "reader").length;
