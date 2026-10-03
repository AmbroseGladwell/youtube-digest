import { describe, expect, it } from "vitest";
import { readDeviceAccountHistory, writeDeviceAccountHistory } from "./deviceAccountHistoryStorage.js";
import { NO_ACCOUNT_HISTORY } from "./types/DeviceAccountHistory.js";

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

describe("deviceAccountHistoryStorage", () => {
  it("is a device that has never had an account until something is written", () => {
    expect(readDeviceAccountHistory(makeStorage())).toEqual(NO_ACCOUNT_HISTORY);
  });

  it("round-trips what the device remembers", () => {
    const storage = makeStorage();
    writeDeviceAccountHistory({ signedOutHere: true, offerDismissed: false }, storage);
    expect(readDeviceAccountHistory(storage)).toEqual({ signedOutHere: true, offerDismissed: false });
  });

  it("treats what it cannot read as never having had an account", () => {
    const storage = makeStorage();
    storage.setItem("overview.deviceAccountHistory.v1", "{not json");
    expect(readDeviceAccountHistory(storage)).toEqual(NO_ACCOUNT_HISTORY);
  });
});
