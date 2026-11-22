import { tokenUsageOf, type TokenUsage } from "@overview/generation";
import { CHAT_REPLY_SCHEMA } from "./ChatReply.js";
import { chatModel } from "./chatModel.js";

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionSetup {
  apiKey: string;
  http: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  retried: (status: number) => void;
}

export interface ChatCompletionStream {
  // The reply's JSON text, piece by piece.
  pieces: AsyncGenerator<string>;
  // Known once pieces is done; null if the provider never said.
  usage: () => TokenUsage | null;
  // "length" when the reply ran into its cap: Luna's reasoning counts, so a reply can be cut off
  // before a word of it is written.
  finishReason: () => string | null;
}

export class ChatProviderError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.status = status;
  }
}

const RETRIED_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_WAITS_MS = [1_000, 3_000];
const LONGEST_RETRY_WAIT_MS = 5_000;
// Luna's reasoning counts against the cap: at 1,000, OV-307's "score my desserts against these
// reflexes" was cut off before a word, every time (OV-353). The prompt sets an answer's length; the
// cap only bounds the worst case, about $0.002 at Luna's output price.
export const MAX_ANSWER_TOKENS = 4_000;

// What the reply must look like and how long it may run: an overview's chat by default; a library
// or project chat picks with one schema and answers in sections with another (OV-353).
export interface ReplyShape {
  name: string;
  schema: object;
  maxTokens: number;
}

const CHAT_REPLY: ReplyShape = { name: "chat_reply", schema: CHAT_REPLY_SCHEMA, maxTokens: MAX_ANSWER_TOKENS };

// A refusal for now (a rate limit, an overloaded provider) is asked again after a wait,
// quietly, before anything has streamed; anything else, or a third refusal, fails.
export const streamChatCompletion = async (
  { apiKey, http, sleep, retried }: ChatCompletionSetup,
  messages: readonly PromptMessage[],
  cacheKey: string,
  shape: ReplyShape = CHAT_REPLY,
): Promise<ChatCompletionStream> => {
  const body = JSON.stringify({
    model: chatModel.model,
    max_completion_tokens: shape.maxTokens,
    messages,
    prompt_cache_key: cacheKey,
    stream: true,
    stream_options: { include_usage: true },
    response_format: { type: "json_schema", json_schema: { name: shape.name, strict: true, schema: shape.schema } },
  });
  for (let attempt = 0; ; attempt += 1) {
    const response = await http("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok && response.body !== null) {
      return readStream(response.body);
    }
    const wait = RETRY_WAITS_MS[attempt];
    if (!RETRIED_STATUSES.has(response.status) || wait === undefined) {
      throw new ChatProviderError(response.status, `The provider answered ${response.status}`);
    }
    retried(response.status);
    const asked = Number(response.headers.get("retry-after")) * 1000;
    await sleep(Number.isFinite(asked) && asked > 0 ? Math.min(asked, LONGEST_RETRY_WAIT_MS) : wait);
  }
};

const readStream = (body: ReadableStream<Uint8Array>): ChatCompletionStream => {
  let usage: TokenUsage | null = null;
  let finishReason: string | null = null;
  const pieces = async function* (): AsyncGenerator<string> {
    const decoder = new TextDecoder();
    let buffered = "";
    for await (const bytes of body as unknown as AsyncIterable<Uint8Array>) {
      buffered += decoder.decode(bytes, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          return;
        }
        const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>; usage?: unknown };
        if (chunk.usage !== undefined && chunk.usage !== null) {
          usage = tokenUsageOf("openai", chunk);
        }
        const finished = chunk.choices?.[0]?.finish_reason;
        if (typeof finished === "string") {
          finishReason = finished;
        }
        const content = chunk.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
          yield content;
        }
      }
    }
  };
  return { pieces: pieces(), usage: () => usage, finishReason: () => finishReason };
};
