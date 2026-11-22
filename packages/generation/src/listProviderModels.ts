import type { Provider } from "@overview/domain";
import type { ModelListing } from "./ProviderAdapter.js";
import { adapterFor } from "./adapterFor.js";

// Asked with the reader's own key: docs/features/byo-providers.md, "Which models are offered".
export const listProviderModels = (
  provider: Provider,
  apiKey: string,
  http: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<ModelListing> => {
  return adapterFor(provider).listModels(apiKey, http);
};
