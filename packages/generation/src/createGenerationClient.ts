import type { Provider } from "@overview/domain";
import type { GenerationClient } from "./generateOverview.js";
import { adapterFor } from "./adapterFor.js";

export interface GenerationClientOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  http?: typeof fetch;
}

// The key is held by whichever document is calling and goes straight to the provider; no
// server of ours is in the path (docs/architecture/v1-architecture-decisions.md, Model D).
// Every one of the six answers a cross-origin preflight, which is the only reason this
// shape is available at all.
export function createGenerationClient({
  provider,
  apiKey,
  model,
  http = globalThis.fetch.bind(globalThis),
}: GenerationClientOptions): GenerationClient {
  const adapter = adapterFor(provider);
  return (request) => adapter.generate({ apiKey, model }, request, http);
}
