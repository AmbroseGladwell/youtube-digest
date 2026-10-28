import { describe, expect, it } from "vitest";
import { readSignedOutTrial, writeSignedOutTrial } from "./signedOutTrialStorage.js";
import { NO_TRIAL } from "./types/SignedOutTrial.js";

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

describe("signedOutTrialStorage", () => {
  it("is a device that has made nothing signed out until something is written", () => {
    expect(readSignedOutTrial(makeStorage())).toEqual(NO_TRIAL);
  });

  it("round-trips the token", () => {
    const storage = makeStorage();
    writeSignedOutTrial({ token: "trial-token" }, storage);
    expect(readSignedOutTrial(storage)).toEqual({ token: "trial-token" });
  });

  it("treats what it cannot read as a fresh trial", () => {
    const storage = makeStorage();
    storage.setItem("overview.signedOutTrial.v1", "{not json");
    expect(readSignedOutTrial(storage)).toEqual(NO_TRIAL);
  });
});
