import { z } from "zod";
import { ChatMessage, ChatSource } from "./Chat.js";

// What the answer's stream carries, one server-sent event each: the other overviews this question
// added to the conversation, when it added any, then the answer's text as it arrives, then the two
// messages as they were stored, or a failure that stored nothing (docs/features/chats.md, "Asking").
export const ChatStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sources"), pinned: z.array(ChatSource), found: z.array(ChatSource) }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("answered"), chatId: z.string(), rev: z.number().int(), messages: z.array(ChatMessage) }),
  z.object({ type: z.literal("failed"), message: z.string() }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEvent>;
