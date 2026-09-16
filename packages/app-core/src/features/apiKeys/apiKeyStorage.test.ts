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

describe("apiKeyStorage", () => {
  it("returns the default keys when nothing has been stored", () => {
    expect(readApiKeys(makeStorage())).toEqual(DEFAULT_API_KEYS);
  });

  it("round-trips keys written through writeApiKeys", () => {
    const storage = makeStorage();
    writeApiKeys({ anthropicApiKey: "sk-ant-x", supadataApiKey: "sd-x" }, storage);
    expect(readApiKeys(storage)).toEqual({ anthropicApiKey: "sk-ant-x", supadataApiKey: "sd-x" });
  });

  it("falls back to the default when stored data fails schema validation", () => {
    const storage = makeStorage();
    storage.setItem("overview.apiKeys.v1", JSON.stringify({ anthropicApiKey: 42 }));
    expect(readApiKeys(storage)).toEqual(DEFAULT_API_KEYS);
  });
});
