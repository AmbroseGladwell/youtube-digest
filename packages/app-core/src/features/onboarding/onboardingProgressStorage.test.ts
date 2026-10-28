import { describe, expect, it } from "vitest";
import { OverviewId } from "@overview/domain";
import { readOnboardingProgress, writeOnboardingProgress, type OnboardingProgress } from "./onboardingProgressStorage.js";

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

const progress: OnboardingProgress = {
  link: "https://www.youtube.com/watch?v=abc",
  videoUrl: "https://www.youtube.com/watch?v=abc",
  step: "topics",
  topics: ["Food", "chess"],
  mayWrite: false,
  overviewId: OverviewId.parse(crypto.randomUUID()),
  way: null,
};

describe("onboardingProgressStorage", () => {
  it("reads back what was written", () => {
    const storage = memoryStorage();
    writeOnboardingProgress(progress, storage);
    expect(readOnboardingProgress(storage)).toEqual(progress);
  });

  it("forgets it once onboarding is over", () => {
    const storage = memoryStorage();
    writeOnboardingProgress(progress, storage);
    writeOnboardingProgress(null, storage);
    expect(readOnboardingProgress(storage)).toBeNull();
  });

  it("reads nothing back from a record it can't parse", () => {
    const storage = memoryStorage();
    storage.setItem("overview.onboarding.v1", JSON.stringify({ ...progress, step: "somewhere" }));
    expect(readOnboardingProgress(storage)).toBeNull();
  });
});
