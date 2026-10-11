import { describe, expect, it } from "vitest";
import { readApiKeys, writeApiKeys } from "./apiKeyStorage.js";
import { DEFAULT_API_KEYS } from "./ApiKeys.js";

const makeStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => void data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
};

const anthropicKey = { key: "sk-ant-x", addedAt: "2026-09-12T09:00:00.000Z" };

describe("apiKeyStorage", () => {
  it("returns the default keys when nothing has been stored", () => {
    expect(readApiKeys(makeStorage())).toEqual(DEFAULT_API_KEYS);
  });

  it("round-trips keys written through writeApiKeys", () => {
    const storage = makeStorage();

    writeApiKeys({ keys: { anthropic: anthropicKey, openai: { key: "sk-oa", addedAt: null } } }, storage);

    expect(readApiKeys(storage).keys.anthropic).toEqual(anthropicKey);
    expect(readApiKeys(storage).keys.openai?.key).toBe("sk-oa");
  });

  it("falls back to the default when stored data fails schema validation", () => {
    const storage = makeStorage();

    storage.setItem("overview.apiKeys.v2", JSON.stringify({ keys: { anthropic: 42 } }));

    expect(readApiKeys(storage)).toEqual(DEFAULT_API_KEYS);
  });

  it("falls back to the default when the stored data is not JSON at all", () => {
    const storage = makeStorage();

    storage.setItem("overview.apiKeys.v2", "not json");

    expect(readApiKeys(storage)).toEqual(DEFAULT_API_KEYS);
  });

  it("reads a key saved by the build that only knew Anthropic", () => {
    const storage = makeStorage();

    storage.setItem("overview.apiKeys.v1", JSON.stringify({ anthropicApiKey: "sk-ant-old" }));

    expect(readApiKeys(storage).keys.anthropic).toEqual({ key: "sk-ant-old", addedAt: null });
  });

  it("leaves the older key where it is, so going back to an older build still finds it", () => {
    const storage = makeStorage();
    storage.setItem("overview.apiKeys.v1", JSON.stringify({ anthropicApiKey: "sk-ant-old" }));

    readApiKeys(storage);

    expect(storage.getItem("overview.apiKeys.v1")).toBe(JSON.stringify({ anthropicApiKey: "sk-ant-old" }));
  });

  it("prefers what this build wrote over what the older one did", () => {
    const storage = makeStorage();
    storage.setItem("overview.apiKeys.v1", JSON.stringify({ anthropicApiKey: "sk-ant-old" }));
    writeApiKeys({ keys: { openai: { key: "sk-oa", addedAt: null } } }, storage);

    expect(readApiKeys(storage).keys.anthropic).toBeUndefined();
    expect(readApiKeys(storage).keys.openai?.key).toBe("sk-oa");
  });

  it("reads an older record holding no key as no keys at all", () => {
    const storage = makeStorage();

    storage.setItem("overview.apiKeys.v1", JSON.stringify({ anthropicApiKey: null }));

    expect(readApiKeys(storage)).toEqual(DEFAULT_API_KEYS);
  });
});
