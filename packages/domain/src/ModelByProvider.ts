import { z } from "zod";
import { DEFAULT_MODEL } from "./KnownModel.js";
import { Provider } from "./Provider.js";

// The model each provider is set to, remembered per provider so that switching provider
// and switching back does not reset the choice (design 110c, "Switching never resets a
// model"). Partial: a provider the reader has never chosen a model for has no entry, and
// falls back to the one we would have picked.
export const ModelByProvider = z.partialRecord(Provider, z.string());
export type ModelByProvider = z.infer<typeof ModelByProvider>;

// Free text rather than an enum of ids, unlike every other choice in Settings. A reader's
// key can reach models we have never heard of, the picker offers them (design 110e), and
// a provider retiring one must not make the whole settings record unreadable.
export const modelFor = (models: ModelByProvider, provider: Provider): string =>
  models[provider] ?? DEFAULT_MODEL[provider];
