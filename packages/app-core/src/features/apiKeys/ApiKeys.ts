import { z } from "zod";
import { Provider } from "@overview/domain";

export const StoredKey = z.object({
  key: z.string(),
  addedAt: z.iso.datetime().nullable(),
});
export type StoredKey = z.infer<typeof StoredKey>;

// Never on synced Settings, and one per provider: docs/features/byo-providers.md, "The shape of it".
export const ApiKeys = z.object({
  keys: z.partialRecord(Provider, StoredKey),
});
export type ApiKeys = z.infer<typeof ApiKeys>;

export const DEFAULT_API_KEYS: ApiKeys = { keys: {} };

export const hasKeyFor = (apiKeys: ApiKeys, provider: Provider): boolean => apiKeys.keys[provider] !== undefined;

export const providersWithKeys = (apiKeys: ApiKeys): Provider[] => Provider.options.filter((provider) => hasKeyFor(apiKeys, provider));

// A key too short to be real is shown whole, not padded: the row saying so is the point.
export const keyEnding = (stored: StoredKey): string => stored.key.slice(-4);
