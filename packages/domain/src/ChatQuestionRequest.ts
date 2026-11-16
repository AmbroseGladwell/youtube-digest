import { z } from "zod";

export const MAX_CHAT_QUESTION_LENGTH = 2_000;

// A reader's question to POST /api/chats/:overviewId/messages: a new conversation is a new
// uuid, a follow-up repeats its conversation's (docs/features/chats.md).
export const ChatQuestionRequest = z.object({
  conversationId: z.uuid(),
  text: z.string().trim().min(1).max(MAX_CHAT_QUESTION_LENGTH),
});
export type ChatQuestionRequest = z.infer<typeof ChatQuestionRequest>;
