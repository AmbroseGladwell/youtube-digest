import type { Provider } from "@overview/domain";
import type { GenerationClient } from "./requestGeneratedOutput.js";
import { adapterFor } from "./adapterFor.js";

export interface GenerationClientOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  http?: typeof fetch;
}

// The key goes straight to the provider, which only works because all six answer a CORS preflight.
export const createGenerationClient = ({
  provider,
  apiKey,
  model,
  http = globalThis.fetch.bind(globalThis),
}: GenerationClientOptions): GenerationClient => {
  const adapter = adapterFor(provider);
  return (request) => adapter.generate({ apiKey, model }, request, http);
};
