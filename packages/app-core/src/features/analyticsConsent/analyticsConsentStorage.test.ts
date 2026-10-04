import { describe, expect, it } from "vitest";
import { readAnalyticsConsent, writeAnalyticsConsent } from "./analyticsConsentStorage.js";
import type { AnalyticsConsent } from "./types/AnalyticsConsent.js";

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

const SHARING: AnalyticsConsent = {
  answer: "share",
  answeredAt: "2026-10-03T09:00:00.000Z",
  purposesVersion: 1,
  anonymousId: "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
};

describe("analyticsConsentStorage", () => {
  it("has no answer until one is written", () => {
    expect(readAnalyticsConsent(makeStorage())).toBeNull();
  });

  it("round-trips the answer, when it was given, and the id", () => {
    const storage = makeStorage();
    writeAnalyticsConsent(SHARING, storage);
    expect(readAnalyticsConsent(storage)).toEqual(SHARING);
  });

  it("forgets everything when the answer is cleared", () => {
    const storage = makeStorage();
    writeAnalyticsConsent(SHARING, storage);
    writeAnalyticsConsent(null, storage);
    expect(storage.length).toBe(0);
  });

  it("treats what it cannot read as no answer, so the reader is asked rather than counted", () => {
    const storage = makeStorage();
    storage.setItem("overview.analyticsConsent.v1", JSON.stringify({ ...SHARING, anonymousId: "reader@example.com" }));
    expect(readAnalyticsConsent(storage)).toBeNull();
    storage.setItem("overview.analyticsConsent.v1", "{");
    expect(readAnalyticsConsent(storage)).toBeNull();
  });
});
