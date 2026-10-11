import type { Provider } from "@overview/domain";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";

// A key per provider is the shape now (docs/features/byo-providers.md), and almost every
// scenario wants only "this device can generate". One helper so that adding a field to a
// stored key does not mean editing thirty scenarios again.
export const keysFor = (...providers: Provider[]): ApiKeys => ({
  keys: Object.fromEntries(
    providers.map((provider) => [provider, { key: `sk-${provider}-test`, addedAt: "2026-09-12T09:00:00.000Z" }]),
  ),
});

export const ANTHROPIC_KEY: ApiKeys = keysFor("anthropic");

export const NO_KEYS: ApiKeys = { keys: {} };
