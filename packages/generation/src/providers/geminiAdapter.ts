import type { GenerationRequest, ModelListing, ProviderAdapter, ProviderCall } from "../ProviderAdapter.js";
import { GenerationError, providerFailure } from "../GenerationError.js";
import { providerJsonSchema } from "../providerJsonSchema.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// A header, not the query string: a URL carrying a secret ends up in logs.
const headers = (apiKey: string) => ({ "content-type": "application/json", "x-goog-api-key": apiKey });

const MODELS_PREFIX = "models/";
const withoutModelsPrefix = (name: string) => (name.startsWith(MODELS_PREFIX) ? name.slice(MODELS_PREFIX.length) : name);

export const geminiAdapter: ProviderAdapter = {
  async generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown> {
    const response = await http(`${BASE_URL}/models/${encodeURIComponent(withoutModelsPrefix(call.model))}:generateContent`, {
      method: "POST",
      headers: headers(call.apiKey),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userMessage }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // Not responseSchema, whose OpenAPI subset can't express a nullable object.
          responseJsonSchema: providerJsonSchema(request.schema),
        },
      }),
    });

    if (!response.ok) {
      throw providerFailure(response.status, await response.text());
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    if (typeof text !== "string") {
      throw new GenerationError("Gemini's response had no text content to parse");
    }
    return JSON.parse(text);
  },

  async listModels(apiKey: string, http: typeof fetch): Promise<ModelListing> {
    const response = await http(`${BASE_URL}/models?pageSize=200`, { headers: headers(apiKey) });
    if (!response.ok) {
      throw providerFailure(response.status, await response.text());
    }
    const body = (await response.json()) as {
      models?: { name?: unknown; supportedGenerationMethods?: unknown }[];
    };
    const listed = body.models ?? [];
    const usable = listed
      .filter((model) => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
      .map((model) => (typeof model.name === "string" ? withoutModelsPrefix(model.name) : ""))
      .filter((id) => id !== "");
    return { usable: [...new Set(usable)].sort(), unusable: listed.length - usable.length };
  },
};
