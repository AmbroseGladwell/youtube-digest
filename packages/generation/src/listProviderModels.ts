import type { Provider } from "@overview/domain";
import type { ModelListing } from "./ProviderAdapter.js";
import { adapterFor } from "./adapterFor.js";

// Asked with the reader's own key, which is what makes it worth asking: the answer is the
// models that key can actually reach, not the ones the provider advertises. It doubles as
// the check that the key works at all — design 110d saves and lists in one beat, and
// design 110f is this call coming back refused.
export function listProviderModels(
  provider: Provider,
  apiKey: string,
  http: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<ModelListing> {
  return adapterFor(provider).listModels(apiKey, http);
}
