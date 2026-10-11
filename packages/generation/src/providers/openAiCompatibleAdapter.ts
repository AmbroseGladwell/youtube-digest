import type { GenerationRequest, ModelListing, ProviderAdapter, ProviderCall } from "../ProviderAdapter.js";
import { GenerationError, providerFailure } from "../GenerationError.js";
import { providerJsonSchema } from "../providerJsonSchema.js";
import { usableModels } from "./usableModels.js";

// Four of the six speak OpenAI's chat-completions dialect: OpenAI itself, DeepSeek, xAI
// and Mistral. They differ in one thing that matters, whether they will take a schema, so
// that is the only thing this takes as an option.
export interface OpenAiCompatibleOptions {
  baseUrl: string;
  // "schema" is enforced by the provider; "prose" is DeepSeek, which has JSON mode and no
  // schema at all, so the shape is taught in the prompt and checked on the way back by
  // generateOverview's existing correction pass.
  structure: "schema" | "prose";
}

const MAX_TOKENS = 16000;

export function openAiCompatibleAdapter({ baseUrl, structure }: OpenAiCompatibleOptions): ProviderAdapter {
  return {
    async generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown> {
      const schema = providerJsonSchema(request.schema);
      const system =
        structure === "schema"
          ? request.systemPrompt
          : // DeepSeek's JSON mode requires the word "json" in the prompt, and the shape has
            // to arrive the same way. The schema is the same object the others are sent.
            `${request.systemPrompt}\n\nReply with one json object and nothing else. It must match this JSON schema exactly:\n${JSON.stringify(schema)}`;

      const response = await http(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${call.apiKey}` },
        body: JSON.stringify({
          model: call.model,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: request.userMessage },
          ],
          response_format:
            structure === "schema"
              ? { type: "json_schema", json_schema: { name: "overview", strict: true, schema } }
              : { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw providerFailure(response.status, await response.text());
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new GenerationError("the provider's response had no text content to parse");
      }
      return JSON.parse(content);
    },

    async listModels(apiKey: string, http: typeof fetch): Promise<ModelListing> {
      const response = await http(`${baseUrl}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        throw providerFailure(response.status, await response.text());
      }
      const body = (await response.json()) as {
        data?: { id?: unknown; capabilities?: { completion_chat?: unknown } }[];
      };
      const listed = body.data ?? [];
      const ids = listed.filter((model): model is { id: string } => typeof model.id === "string");

      // Mistral is the one in this family that says outright what each model can do. The
      // rest are judged by name, which is why the ones we are unsure of are offered rather
      // than hidden.
      const saysSo = ids.filter((model) => typeof (model as { capabilities?: unknown }).capabilities === "object");
      if (saysSo.length === ids.length && ids.length > 0) {
        const usable = ids
          .filter((model) => (model as { capabilities?: { completion_chat?: unknown } }).capabilities?.completion_chat === true)
          .map((model) => model.id);
        return { usable: [...new Set(usable)].sort(), unusable: ids.length - usable.length };
      }

      return usableModels(ids.map((model) => model.id));
    },
  };
}
