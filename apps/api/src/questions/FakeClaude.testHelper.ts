import type { PromptMessage } from "../chats/streamChatCompletion.js";

export interface FakeClaude {
  http: typeof fetch;
  requests: Array<{ model: unknown; messages: PromptMessage[]; maxTokens: unknown }>;
}

export const CLAUDE_USAGE = { input_tokens: 2_000, output_tokens: 250 };

// Answers Anthropic's messages API with the reply as the JSON text block; the system prompt is kept as the first message.
export const makeFakeClaude = ({ reply, usage = CLAUDE_USAGE }: { reply: unknown; usage?: unknown }): FakeClaude => {
  const fake: FakeClaude = {
    requests: [],
    http: (async (_url: string | URL | Request, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body)) as { model: unknown; system: string; messages: PromptMessage[]; max_tokens: unknown };
      fake.requests.push({
        model: body.model,
        messages: [{ role: "system", content: body.system }, ...body.messages],
        maxTokens: body.max_tokens,
      });
      const text = typeof reply === "string" ? reply : JSON.stringify(reply);
      return new Response(JSON.stringify({ content: [{ type: "text", text }], usage }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  };
  return fake;
};
