import { describe, expect, it } from "vitest";
import {
  writeCaptureQueuePreferences,
  readCaptureQueuePreferences,
  DEFAULT_CAPTURE_QUEUE_PREFERENCES,
} from "../captureQueue/captureQueuePreferencesStorage.js";
import { readLibraryView, writeLibraryView } from "../library/libraryViewStorage.js";
import { NO_LIBRARY_FILTERS } from "../library/types/LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT } from "../library/types/LibrarySort.js";
import { readReadingPosition, writeReadingPosition } from "../transcripts/readingPositionStorage.js";
import { markAccountSeen, readAccountSeen } from "./accountSeenStorage.js";
import { forgetAccountOnDevice } from "./forgetAccountOnDevice.js";

const ACCOUNT = "0b6f3c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const OTHER = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
};

describe("forgetAccountOnDevice", () => {
  it("removes the account's view, queue preferences and reading positions, and nothing of anyone else's", () => {
    const storage = memoryStorage();
    for (const accountId of [ACCOUNT, OTHER, null]) {
      writeReadingPosition("video", 1200, accountId, storage);
      writeCaptureQueuePreferences(accountId, { ...DEFAULT_CAPTURE_QUEUE_PREFERENCES, paused: true }, storage);
    }
    const view = { filters: { ...NO_LIBRARY_FILTERS, status: "read" as const }, sort: DEFAULT_LIBRARY_SORT };
    writeLibraryView(ACCOUNT, view, storage);
    writeLibraryView(OTHER, view, storage);
    markAccountSeen(storage);

    forgetAccountOnDevice(ACCOUNT, storage);

    expect(readReadingPosition("video", ACCOUNT, storage)).toBeNull();
    expect(readCaptureQueuePreferences(ACCOUNT, storage).paused).toBe(false);
    expect(readLibraryView(ACCOUNT, storage)).toBeNull();
    expect(readReadingPosition("video", OTHER, storage)).toBe(1200);
    expect(readReadingPosition("video", null, storage)).toBe(1200);
    expect(readCaptureQueuePreferences(OTHER, storage).paused).toBe(true);
    expect(readLibraryView(OTHER, storage)).not.toBeNull();
    expect(readAccountSeen(storage)).toBe(true);
  });
});
