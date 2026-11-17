import { z } from "zod";

export const ChatReply = z.object({
  answer: z.string(),
  passages: z.array(z.string()),
  chatMessages: z.array(z.string()),
  inSource: z.boolean(),
});
export type ChatReply = z.infer<typeof ChatReply>;

// answer first, so its text can be streamed while the ids are still to come.
export const CHAT_REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "passages", "chatMessages", "inSource"],
  properties: {
    answer: { type: "string" },
    passages: { type: "array", items: { type: "string" } },
    chatMessages: { type: "array", items: { type: "string" } },
    inSource: { type: "boolean" },
  },
} as const;
