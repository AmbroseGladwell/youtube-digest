import type { TokenUsage } from "@overview/generation";
import type { z } from "zod";
import { streamChatCompletion, type ChatCompletionSetup, type PromptMessage, type ReplyShape } from "../chats/streamChatCompletion.js";

export interface JsonReply<T> {
  value: T;
  usage: TokenUsage | null;
}

export class UnreadableReplyError extends Error {
  readonly usage: TokenUsage | null;

  constructor(usage: TokenUsage | null) {
    super("The reply did not match its shape");
    this.usage = usage;
  }
}

const parsedOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const askForJson = async <T>(
  setup: ChatCompletionSetup,
  messages: readonly PromptMessage[],
  cacheKey: string,
  shape: ReplyShape,
  schema: z.ZodType<T>,
): Promise<JsonReply<T>> => {
  const stream = await streamChatCompletion(setup, messages, cacheKey, shape);
  let text = "";
  for await (const piece of stream.pieces) {
    text += piece;
  }
  const parsed = schema.safeParse(parsedOrNull(text));
  if (!parsed.success) {
    throw new UnreadableReplyError(stream.usage());
  }
  return { value: parsed.data, usage: stream.usage() };
};
