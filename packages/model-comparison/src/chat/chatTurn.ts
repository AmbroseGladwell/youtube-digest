import { tokenUsageOf, type TokenUsage } from "@overview/generation";
import { z } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const ChatReply = z.object({
  answer: z.string(),
  passages: z.array(z.string()),
  inSource: z.boolean(),
});
export type ChatReply = z.infer<typeof ChatReply>;

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "passages", "inSource"],
  properties: {
    answer: { type: "string" },
    passages: { type: "array", items: { type: "string" } },
    inSource: { type: "boolean" },
  },
};

export interface ChatTurnResult {
  reply: ChatReply;
  raw: string;
  usage: TokenUsage;
  latencyMs: number;
}

export const chatTurn = async (
  apiKey: string,
  model: string,
  messages: readonly ChatMessage[],
  cacheKey: string,
): Promise<ChatTurnResult> => {
  const started = performance.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 4000,
      messages,
      prompt_cache_key: cacheKey,
      response_format: { type: "json_schema", json_schema: { name: "chat_reply", strict: true, schema: REPLY_SCHEMA } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    throw new Error(`OpenAI answered ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const latencyMs = Math.round(performance.now() - started);
  const raw = body.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new Error("the reply had no text content");
  }
  const usage = tokenUsageOf("openai", body);
  if (usage === null) {
    throw new Error("the reply had no token usage");
  }
  return { reply: ChatReply.parse(JSON.parse(raw)), raw, usage, latencyMs };
};
