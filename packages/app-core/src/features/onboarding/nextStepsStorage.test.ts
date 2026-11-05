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
    const nextSteps = { overviewId: OverviewId.parse(crypto.randomUUID()), dismissed: ["ai" as const], forAnyone: null, sample: true };
    writeNextSteps(nextSteps, storage);
    expect(readNextSteps(storage)).toEqual(nextSteps);
  });

  it("reads next steps kept before samples as not from a sample", () => {
    const storage = memoryStorage();
    const overviewId = OverviewId.parse(crypto.randomUUID());
    storage.setItem("overview.nextSteps.v1", JSON.stringify({ overviewId, dismissed: [], forAnyone: null }));
    expect(readNextSteps(storage)?.sample).toBe(false);
  });

  it("reads nothing back when nothing was written", () => {
    expect(readNextSteps(memoryStorage())).toBeNull();
  });
});
