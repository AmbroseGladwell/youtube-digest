import { ANTHROPIC_MESSAGES_URL, anthropicServerHeaders, tokenUsageOf } from "@overview/generation";
import type { z } from "zod";
import type { PromptMessage, ReplyShape } from "../chats/streamChatCompletion.js";
import { UnreadableReplyError, type JsonReply } from "./askForJson.js";

export interface ClaudeSetup {
  apiKey: string;
  http: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  retried: (status: number) => void;
}

const RETRIED_STATUSES = new Set([429, 500, 502, 503, 529]);
const RETRY_DELAYS_MS = [1_000, 4_000];

const parsedOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const post = async (setup: ClaudeSetup, body: string): Promise<Response> => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await setup.http(ANTHROPIC_MESSAGES_URL, { method: "POST", headers: anthropicServerHeaders(setup.apiKey), body });
    const delay = RETRY_DELAYS_MS[attempt];
    if (response.ok || !RETRIED_STATUSES.has(response.status) || delay === undefined) {
      return response;
    }
    setup.retried(response.status);
    await setup.sleep(delay);
  }
};

// The question writer on our Claude key, with the reply held to its JSON schema (docs/features/suggested-questions.md, "Writing").
export const askClaudeForJson = async <T>(
  setup: ClaudeSetup,
  messages: readonly PromptMessage[],
  shape: ReplyShape & { model: string },
  schema: z.ZodType<T>,
): Promise<JsonReply<T>> => {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content);
  const turns = messages.filter((message) => message.role !== "system");
  const response = await post(
    setup,
    JSON.stringify({
      model: shape.model,
      max_tokens: shape.maxTokens,
      system: system.join("\n\n"),
      messages: turns,
      output_config: { format: { type: "json_schema", schema: shape.schema } },
    }),
  );
  if (!response.ok) {
    throw new Error(`Anthropic answered ${response.status}`);
  }
  const body = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const usage = tokenUsageOf("anthropic", body);
  const text = body.content?.find((block) => block.type === "text")?.text ?? "";
  const parsed = schema.safeParse(parsedOrNull(text));
  if (!parsed.success) {
    throw new UnreadableReplyError(usage);
  }
  return { value: parsed.data, usage };
};
