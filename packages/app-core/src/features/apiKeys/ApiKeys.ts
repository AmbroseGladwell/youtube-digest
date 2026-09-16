import { z } from "zod";

// BYO-key generation (docs/architecture/v1-architecture-decisions.md: "Generation stays
// BYO-key at every tier") — deliberately not part of the synced Settings type. A provider
// key must never leave this device, even for a signed-in user, so it gets its own
// device-local storage rather than living on the type that's designed to sync.
export const ApiKeys = z.object({
  anthropicApiKey: z.string().nullable(),
  supadataApiKey: z.string().nullable(),
});
export type ApiKeys = z.infer<typeof ApiKeys>;

export const DEFAULT_API_KEYS: ApiKeys = {
  anthropicApiKey: null,
  supadataApiKey: null,
};

export const hasRequiredApiKeys = (keys: ApiKeys): boolean =>
  keys.anthropicApiKey !== null && keys.supadataApiKey !== null;
