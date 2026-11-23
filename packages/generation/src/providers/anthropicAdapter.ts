import type { GenerationRequest, ModelListing, ProviderAdapter, ProviderCall } from "../ProviderAdapter.js";
import { GenerationError, providerFailure } from "../GenerationError.js";
import { providerJsonSchema } from "../providerJsonSchema.js";
import { usableModels } from "./usableModels.js";

const BASE_URL = "https://api.anthropic.com/v1";
const MAX_TOKENS = 16000;

// Unenforced, Claude may fence the object or add a sentence after it.
const firstJsonObject = (text: string): string => {
  const start = text.indexOf("{");
  if (start === -1) {
    return text;
  }
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") {
        i++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
};

export const ANTHROPIC_MESSAGES_URL = `${BASE_URL}/messages`;

export const anthropicServerHeaders = (apiKey: string) => ({
  "content-type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
});

// Sent by hand: it's the header Anthropic requires before it answers a browser at all.
const headers = (apiKey: string) => ({ ...anthropicServerHeaders(apiKey), "anthropic-dangerous-direct-browser-access": "true" });

// docs/features/overview-generation-decisions.md, "The schema has to fit Claude's grammar".
const GRAMMAR_REFUSED = /compiled grammar is too large|schema is too complex/i;

export const anthropicAdapter: ProviderAdapter = {
  async generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown> {
    const schema = providerJsonSchema(request.schema);
    const send = (enforced: boolean) =>
      http(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: headers(call.apiKey),
        body: JSON.stringify({
          model: call.model,
          max_tokens: MAX_TOKENS,
          system: enforced
            ? request.systemPrompt
            : `${request.systemPrompt}\n\nReply with one JSON object and nothing else. It must match this JSON schema exactly:\n${JSON.stringify(schema)}`,
          messages: [{ role: "user", content: request.userMessage }],
          ...(enforced ? { output_config: { format: { type: "json_schema", schema } } } : {}),
        }),
      });

    let response = await send(true);
    if (response.status === 400) {
      const refusal = await response.text();
      response = GRAMMAR_REFUSED.test(refusal) ? await send(false) : new Response(refusal, { status: 400 });
    }

    if (!response.ok) {
      throw providerFailure(response.status, await response.text());
    }

    const body = (await response.json()) as { content?: { type?: string; text?: unknown }[] };
    const textBlock = body.content?.find((block) => block.type === "text");
    if (textBlock === undefined || typeof textBlock.text !== "string") {
      throw new GenerationError("Claude's response had no text content to parse");
    }
    // Not the SDK's parse helper: it throws away the nearly right answer the correction pass needs.
    return JSON.parse(firstJsonObject(textBlock.text));
  },

  async listModels(apiKey: string, http: typeof fetch): Promise<ModelListing> {
    const response = await http(`${BASE_URL}/models?limit=100`, { headers: headers(apiKey) });
    if (!response.ok) {
      throw providerFailure(response.status, await response.text());
    }
    const body = (await response.json()) as { data?: { id?: unknown }[] };
    const ids = (body.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string");
    return usableModels(ids);
  },
};
