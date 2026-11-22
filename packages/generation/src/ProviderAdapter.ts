import type { z } from "zod";

export interface GenerationRequest {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export interface ProviderCall {
  apiKey: string;
  model: string;
}

// Usable ones by name, the rest counted: docs/features/byo-providers.md, "Which models are offered".
export interface ModelListing {
  usable: string[];
  unusable: number;
}

export interface ProviderAdapter {
  generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown>;
  listModels(apiKey: string, http: typeof fetch): Promise<ModelListing>;
}
