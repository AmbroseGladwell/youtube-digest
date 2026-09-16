import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";

export const DEFAULT_MODEL = "claude-opus-5";

export function createAnthropicGenerationClient(
  client: Anthropic,
  model: string = DEFAULT_MODEL,
): GenerationClient {
  return async ({ systemPrompt, userMessage, schema }) => {
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(schema) },
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new GenerationError("Claude's response had no text content to parse");
    }
    // messages.parse() throws and discards the response on a zod .refine() failure
    // (e.g. a word-count cap) — those aren't representable in the JSON Schema the
    // model saw, so generateOverview's own schema.safeParse checks them and retries.
    return JSON.parse(textBlock.text);
  };
}
