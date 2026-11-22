import { z } from "zod";
import { ApiKeys, DEFAULT_API_KEYS } from "./ApiKeys.js";

const STORAGE_KEY = "overview.apiKeys.v2";
const ANTHROPIC_ONLY_STORAGE_KEY = "overview.apiKeys.v1";

// Read once and left in place: docs/features/byo-providers.md, "Migrations".
const AnthropicOnlyApiKeys = z.object({ anthropicApiKey: z.string().nullable() });

const parse = (raw: string, schema: z.ZodType): unknown => {
  try {
    return schema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false };
  }
};

export const readApiKeys = (storage: Storage = globalThis.localStorage): ApiKeys => {
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
  return { keys: { anthropic: { key: parsed.data.anthropicApiKey, addedAt: null } } };
};

export const writeApiKeys = (keys: ApiKeys, storage: Storage = globalThis.localStorage): void => {
  storage.setItem(STORAGE_KEY, JSON.stringify(keys));
};
