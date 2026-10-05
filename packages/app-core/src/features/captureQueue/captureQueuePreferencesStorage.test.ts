import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_QUEUE_PREFERENCES,
  readCaptureQueuePreferences,
  writeCaptureQueuePreferences,
} from "./captureQueuePreferencesStorage.js";

describe("captureQueuePreferencesStorage", () => {
  beforeEach(() => localStorage.clear());

  it("reads back what this account chose on this device, and nothing another account chose", () => {
    writeCaptureQueuePreferences("account-a", { paused: true, folded: true });

    expect(readCaptureQueuePreferences("account-a")).toEqual({ paused: true, folded: true });
    expect(readCaptureQueuePreferences("account-b")).toEqual(DEFAULT_CAPTURE_QUEUE_PREFERENCES);
  });

  it("a stored value it can't read falls back to running and unfolded", () => {
    localStorage.setItem("overview.captureQueue.noAccount", "{not json");
    expect(readCaptureQueuePreferences(null)).toEqual(DEFAULT_CAPTURE_QUEUE_PREFERENCES);
  });
});
