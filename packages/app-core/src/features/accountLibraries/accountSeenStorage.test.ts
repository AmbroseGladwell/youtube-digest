import { describe, expect, it } from "vitest";
import { markAccountSeen, readAccountSeen } from "./accountSeenStorage.js";

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

describe("accountSeenStorage", () => {
  it("has seen no account until one is marked", () => {
    const storage = memoryStorage();
    expect(readAccountSeen(storage)).toBe(false);
    markAccountSeen(storage);
    expect(readAccountSeen(storage)).toBe(true);
  });
});
