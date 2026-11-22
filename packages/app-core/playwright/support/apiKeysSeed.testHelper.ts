import type { Provider } from "@overview/domain";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";

export const keysFor = (...providers: Provider[]): ApiKeys => ({
  keys: Object.fromEntries(providers.map((provider) => [provider, { key: `sk-${provider}-test`, addedAt: "2026-09-12T09:00:00.000Z" }])),
});

export const ANTHROPIC_KEY: ApiKeys = keysFor("anthropic");

export const NO_KEYS: ApiKeys = { keys: {} };
