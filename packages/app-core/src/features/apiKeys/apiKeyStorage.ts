import { z } from "zod";
import { ApiKeys, DEFAULT_API_KEYS } from "./ApiKeys.js";

const STORAGE_KEY = "overview.apiKeys.v2";
const ANTHROPIC_ONLY_STORAGE_KEY = "overview.apiKeys.v1";

// What the one-provider build wrote. Read once, on the first read after the upgrade, and
// left where it is: a reader who goes back to an older build should still find their key
// (docs/features/byo-providers.md).
const AnthropicOnlyApiKeys = z.object({ anthropicApiKey: z.string().nullable() });

const parse = (raw: string, schema: z.ZodType): unknown => {
  try {
    return schema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false };
  }
};

export function readApiKeys(storage: Storage = globalThis.localStorage): ApiKeys {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const parsed = parse(raw, ApiKeys) as z.ZodSafeParseResult<ApiKeys>;
    return parsed.success ? parsed.data : DEFAULT_API_KEYS;
  }

  const older = storage.getItem(ANTHROPIC_ONLY_STORAGE_KEY);
  if (older === null) {
    return DEFAULT_API_KEYS;
  }
  const parsed = parse(older, AnthropicOnlyApiKeys) as z.ZodSafeParseResult<{ anthropicApiKey: string | null }>;
  if (!parsed.success || parsed.data.anthropicApiKey === null) {
    return DEFAULT_API_KEYS;
  }
  // No date: the older build never recorded when the key was added, and the row says
  // nothing rather than guessing.
  return { keys: { anthropic: { key: parsed.data.anthropicApiKey, addedAt: null } } };
}

export function writeApiKeys(keys: ApiKeys, storage: Storage = globalThis.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
