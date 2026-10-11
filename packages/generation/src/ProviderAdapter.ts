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

// What a provider says its key can reach. The split is the picker's (design 110e): the
// ones that could write an overview are offered by name, and the rest — image, audio,
// embedding and moderation models — are counted rather than listed, because a reader
// scrolling past sixty of them to reach a model they can use is the failure.
export interface ModelListing {
  usable: string[];
  unusable: number;
}

export interface ProviderAdapter {
  generate(call: ProviderCall, request: GenerationRequest, http: typeof fetch): Promise<unknown>;
  listModels(apiKey: string, http: typeof fetch): Promise<ModelListing>;
}
