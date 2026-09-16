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
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (response.parsed_output === null) {
      throw new GenerationError("Claude's response did not parse against the generation schema");
    }
    return response.parsed_output;
  };
}
