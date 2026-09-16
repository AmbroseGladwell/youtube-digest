import { ApiKeys, DEFAULT_API_KEYS } from "./ApiKeys.js";

const STORAGE_KEY = "overview.apiKeys.v1";

export function readApiKeys(storage: Storage = globalThis.localStorage): ApiKeys {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_API_KEYS;
  const parsed = ApiKeys.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : DEFAULT_API_KEYS;
}

export function writeApiKeys(keys: ApiKeys, storage: Storage = globalThis.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
