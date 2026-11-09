import { describe, expect, it } from "vitest";
import { OverviewId, ShareToken, shareSnapshot, SourceKey } from "@overview/domain";
import { makeOverview } from "../overviews/types/OverviewFactory.testHelper.js";
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
  sourceKey: SourceKey.parse("abc"),
  tabId: null,
  step: "topics",
  topics: ["Food", "chess"],
  mayWrite: false,
  overviewId: OverviewId.parse(crypto.randomUUID()),
  runner: "tab-1",
  way: null,
  plan: null,
  landed: null,
  share: null,
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

  it("reads progress written before a share could start it as not from a share", () => {
    const storage = memoryStorage();
    const { share: _share, ...older } = progress;
    storage.setItem("overview.onboarding.v1", JSON.stringify(older));
    expect(readOnboardingProgress(storage)).toEqual(progress);
  });

  it("reads progress from before a run had a tab of its own as run by nobody yet", () => {
    const storage = memoryStorage();
    const { runner: _runner, plan: _plan, landed: _landed, ...older } = progress;
    storage.setItem("overview.onboarding.v1", JSON.stringify(older));
    expect(readOnboardingProgress(storage)).toEqual({ ...progress, runner: null, plan: null, landed: null });
  });

  it("reads a share started before samples could start one as a share, not a sample", () => {
    const storage = memoryStorage();
    const share = {
      token: ShareToken.parse("k7Qm2x9RfTabcdef"),
      snapshot: shareSnapshot({ overview: makeOverview(), transcript: null, narration: null }),
    };
    storage.setItem("overview.onboarding.v1", JSON.stringify({ ...progress, share }));
    expect(readOnboardingProgress(storage)?.share?.sample).toBe(false);
  });

  it("reads progress written before any kind of link was taken as the video it named", () => {
    const storage = memoryStorage();
    const { sourceKey: _sourceKey, ...rest } = progress;
    storage.setItem("overview.onboarding.v1", JSON.stringify({ ...rest, videoUrl: "https://www.youtube.com/watch?v=abc" }));
    expect(readOnboardingProgress(storage)).toEqual(progress);
  });

  it("reads an older playlist's progress, before its video was chosen, as nothing chosen yet", () => {
    const storage = memoryStorage();
    const { sourceKey: _sourceKey, ...rest } = progress;
    storage.setItem("overview.onboarding.v1", JSON.stringify({ ...rest, videoUrl: null }));
    expect(readOnboardingProgress(storage)?.sourceKey).toBeNull();
  });

  it("reads nothing back from a record it can't parse", () => {
    const storage = memoryStorage();
    storage.setItem("overview.onboarding.v1", JSON.stringify({ ...progress, step: "somewhere" }));
    expect(readOnboardingProgress(storage)).toBeNull();
  });
});
