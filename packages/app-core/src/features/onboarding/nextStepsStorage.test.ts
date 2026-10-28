import { describe, expect, it } from "vitest";
import { OverviewId } from "@overview/domain";
import { readNextSteps, writeNextSteps } from "./nextStepsStorage.js";

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

describe("nextStepsStorage", () => {
  it("reads back the overview and what was dismissed", () => {
    const storage = memoryStorage();
    const nextSteps = { overviewId: OverviewId.parse(crypto.randomUUID()), dismissed: ["ai" as const] };
    writeNextSteps(nextSteps, storage);
    expect(readNextSteps(storage)).toEqual(nextSteps);
  });

  it("reads nothing back when nothing was written", () => {
    expect(readNextSteps(memoryStorage())).toBeNull();
  });
});
