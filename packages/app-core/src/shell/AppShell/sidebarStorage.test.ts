import { describe, expect, it } from "vitest";
import { readSidebarChoice, writeSidebarChoice } from "./sidebarStorage.js";

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
};

describe("sidebarStorage", () => {
  it("has no choice until one is made", () => {
    expect(readSidebarChoice(memoryStorage())).toBeNull();
  });

  it("reads back the choice written", () => {
    const storage = memoryStorage();
    writeSidebarChoice("hidden", storage);
    expect(readSidebarChoice(storage)).toBe("hidden");
  });

  it("ignores a value it doesn't know", () => {
    const storage = memoryStorage();
    storage.setItem("overview.sidebar.v1", "sideways");
    expect(readSidebarChoice(storage)).toBeNull();
  });
});
