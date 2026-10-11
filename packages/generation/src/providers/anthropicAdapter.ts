import type { GenerationRequest, ModelListing, ProviderAdapter, ProviderCall } from "../ProviderAdapter.js";
import { GenerationError, providerFailure } from "../GenerationError.js";
import { providerJsonSchema } from "../providerJsonSchema.js";
import { usableModels } from "./usableModels.js";

const BASE_URL = "https://api.anthropic.com/v1";
const MAX_TOKENS = 16000;

// The header Anthropic requires before it will answer a browser at all, and the reason
// the key can live on the device rather than behind a server of ours
// (docs/architecture/v1-architecture-decisions.md, Model D). It is sent by hand rather
// than by the SDK: the SDK's own browser opt-in is the same header, and five of the six
// providers need no SDK at all.
const headers = (apiKey: string) => ({
  "content-type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

export const anthropicAdapter: ProviderAdapter = {
  async generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown> {
    const response = await http(`${BASE_URL}/messages`, {
      method: "POST",
      headers: headers(call.apiKey),
      body: JSON.stringify({
        model: call.model,
        max_tokens: MAX_TOKENS,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userMessage }],
        output_config: { format: { type: "json_schema", schema: providerJsonSchema(request.schema) } },
      }),
    });

    if (!response.ok) {
      throw providerFailure(response.status, await response.text());
    }

    const body = (await response.json()) as { content?: { type?: string; text?: unknown }[] };
    const textBlock = body.content?.find((block) => block.type === "text");
    if (textBlock === undefined || typeof textBlock.text !== "string") {
      throw new GenerationError("Claude's response had no text content to parse");
    }
    // Not the SDK's parse helper: docs/features/overview-generation-decisions.md, "Key points".
    // A response that is nearly right is what the correction pass needs, and parse throws
    // the whole of it away.
    return JSON.parse(textBlock.text);
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
