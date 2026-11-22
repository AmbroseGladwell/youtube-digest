import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { ChatAnswerSections, ChatMessage, ChatSource } from "./Chat.js";

// The order events come in: docs/features/chats.md, "Asking".
export const ChatStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("picking") }),
  z.object({
    type: z.literal("picked"),
    overviews: z.array(z.object({ overviewId: OverviewId, title: z.string() })),
    looked: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("section"), section: ChatAnswerSections.shape.sections.element }),
  z.object({ type: z.literal("sources"), pinned: z.array(ChatSource), found: z.array(ChatSource) }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("answered"), chatId: z.string(), rev: z.number().int(), messages: z.array(ChatMessage) }),
  z.object({ type: z.literal("failed"), message: z.string() }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEvent>;
