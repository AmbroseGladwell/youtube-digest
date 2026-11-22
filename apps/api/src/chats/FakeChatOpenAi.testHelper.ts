import type { PromptMessage } from "./streamChatCompletion.js";

export type FakeChatAnswer = { reply: unknown; usage?: unknown; finishReason?: string } | { status: number; retryAfter?: string };

export interface FakeChatOpenAi {
  http: typeof fetch;
  answers: FakeChatAnswer[];
  requests: Array<{ model: unknown; messages: PromptMessage[]; cacheKey: unknown; stream: unknown }>;
}

export const CHAT_USAGE = { prompt_tokens: 10_000, completion_tokens: 80, prompt_tokens_details: { cached_tokens: 8_000 } };

// OpenAI's streamed chat completions as chat meets them: each call takes the next answer,
// the last one repeating. A reply that isn't a string is sent as its JSON, a few characters
// a chunk, so the answer has to be read as it arrives.
export function makeFakeChatOpenAi(...answers: FakeChatAnswer[]): FakeChatOpenAi {
  const fake: FakeChatOpenAi = {
    answers,
    requests: [],
    http: (async (_url: string | URL | Request, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body)) as {
        model: unknown;
        messages: PromptMessage[];
        prompt_cache_key: unknown;
        stream: unknown;
      };
      fake.requests.push({ model: body.model, messages: body.messages, cacheKey: body.prompt_cache_key, stream: body.stream });
      const answer = fake.answers.length > 1 ? fake.answers.shift()! : fake.answers[0]!;
      if ("status" in answer) {
        return new Response(JSON.stringify({ error: { message: "refused" } }), {
          status: answer.status,
          headers: answer.retryAfter === undefined ? {} : { "retry-after": answer.retryAfter },
        });
      }
      const content = typeof answer.reply === "string" ? answer.reply : JSON.stringify(answer.reply);
      const chunks: string[] = [];
      for (let start = 0; start < content.length; start += 7) {
        chunks.push(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(start, start + 7) } }] })}\n\n`);
      }
      chunks.push(
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: answer.finishReason ?? "stop" }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [], usage: answer.usage ?? CHAT_USAGE })}\n\n`,
        "data: [DONE]\n\n",
      );
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }) as unknown as typeof fetch,
  };
  return fake;
}
