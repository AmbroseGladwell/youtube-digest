import type { GenerationRequest, ModelListing, ProviderAdapter, ProviderCall } from "../ProviderAdapter.js";
import { GenerationError, providerFailure } from "../GenerationError.js";
import { providerJsonSchema } from "../providerJsonSchema.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// The key goes in a header rather than the query string Google's own examples use: a URL
// carrying a secret is a URL that ends up in a log, a referrer or a bug report.
const headers = (apiKey: string) => ({ "content-type": "application/json", "x-goog-api-key": apiKey });

// Gemini names a model "models/gemini-3.6" in its catalogue and takes "gemini-3.6" in a
// call. One spelling is stored and shown; this is where the other one is added and removed.
const bare = (name: string) => (name.startsWith("models/") ? name.slice("models/".length) : name);

export const geminiAdapter: ProviderAdapter = {
  async generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown> {
    const response = await http(`${BASE_URL}/models/${encodeURIComponent(bare(call.model))}:generateContent`, {
      method: "POST",
      headers: headers(call.apiKey),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userMessage }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // responseJsonSchema, not responseSchema: the older field takes an OpenAPI
          // subset that cannot express a nullable object, which most of the optional
          // sections are.
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
    // Google says outright which models answer a generateContent call, so nothing here is
    // judged by its name.
    const usable = listed
      .filter(
        (model) =>
          Array.isArray(model.supportedGenerationMethods) &&
          model.supportedGenerationMethods.includes("generateContent"),
      )
      .map((model) => (typeof model.name === "string" ? bare(model.name) : ""))
      .filter((id) => id !== "");
    return { usable: [...new Set(usable)].sort(), unusable: listed.length - usable.length };
  },
};
