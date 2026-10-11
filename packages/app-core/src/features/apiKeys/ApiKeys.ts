import { z } from "zod";
import { Provider } from "@overview/domain";

// Enough to say "Key ending Yq3f · added 12 September" without holding the key up to the
// screen (design 110b). addedAt is nullable because a key saved before this screen existed
// has no date to show, and inventing one would be a lie about the reader's own device.
export const StoredKey = z.object({
  key: z.string(),
  addedAt: z.iso.datetime().nullable(),
});
export type StoredKey = z.infer<typeof StoredKey>;

// BYO-key generation (docs/architecture/v1-architecture-decisions.md: "Generation stays
// BYO-key at every tier") — deliberately not part of the synced Settings type. A provider
// key must never leave this device, even for a signed-in user, so it gets its own
// device-local storage rather than living on the type that's designed to sync.
//
// One entry per provider the reader has added a key for, not one active key: a reader
// comparing two providers should not have to fetch the first one out of a password
// manager again (design 110c). Which provider is in use lives in Settings, where it syncs;
// that asymmetry is visible on the screen and has a state of its own (design 110g).
export const ApiKeys = z.object({
  keys: z.partialRecord(Provider, StoredKey),
});
export type ApiKeys = z.infer<typeof ApiKeys>;

export const DEFAULT_API_KEYS: ApiKeys = { keys: {} };

export const hasKeyFor = (apiKeys: ApiKeys, provider: Provider): boolean =>
  apiKeys.keys[provider] !== undefined;

export const providersWithKeys = (apiKeys: ApiKeys): Provider[] =>
  Provider.options.filter((provider) => hasKeyFor(apiKeys, provider));

// The last four characters, which is what a reader compares against their provider's own
// list of keys. Short keys are shown whole rather than padded: a key that short is not a
// real one, and the row saying so is the point.
export const keyEnding = (stored: StoredKey): string => stored.key.slice(-4);

// What generation needs is not a fixed pair of keys any more: a browser that fetches its
// own captions needs no transcript key at all, so the question is asked by
// useGenerationReadiness (docs/features/transcript-retrieval.md).
