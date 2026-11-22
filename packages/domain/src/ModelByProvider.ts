import { z } from "zod";
import { DEFAULT_MODEL } from "./KnownModel.js";
import { Provider } from "./Provider.js";

// Per provider, so switching back never resets the choice (design 110c).
export const ModelByProvider = z.partialRecord(Provider, z.string());
export type ModelByProvider = z.infer<typeof ModelByProvider>;

// Free text: keys reach models we don't know (design 110e), and a retired one mustn't break Settings.
export const modelFor = (models: ModelByProvider, provider: Provider): string => models[provider] ?? DEFAULT_MODEL[provider];
