import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_QUEUE_PREFERENCES,
  readCaptureQueuePreferences,
  writeCaptureQueuePreferences,
} from "./captureQueuePreferencesStorage.js";

const NOW = new Date("2026-10-06T21:30:00.000Z");

describe("captureQueuePreferencesStorage", () => {
  beforeEach(() => localStorage.clear());

  it("reads back what this account chose on this device, and nothing another account chose", () => {
    writeCaptureQueuePreferences("account-a", { paused: true, folded: true, hold: null });

    expect(readCaptureQueuePreferences("account-a")).toEqual({ paused: true, folded: true, hold: null });
    expect(readCaptureQueuePreferences("account-b")).toEqual(DEFAULT_CAPTURE_QUEUE_PREFERENCES);
  });

  it("a stored value it can't read falls back to running and unfolded", () => {
    localStorage.setItem("overview.captureQueue.noAccount", "{not json");
    expect(readCaptureQueuePreferences(null)).toEqual(DEFAULT_CAPTURE_QUEUE_PREFERENCES);
  });

  it("a hold is kept across reopening until its time has passed, so the server isn't asked again", () => {
    const hold = { reason: "serverCap" as const, resumesAt: Date.parse("2026-10-07T00:00:00.000Z") };
    writeCaptureQueuePreferences(null, { paused: false, folded: false, hold });

    expect(readCaptureQueuePreferences(null, localStorage, NOW).hold).toEqual(hold);
    expect(readCaptureQueuePreferences(null, localStorage, new Date("2026-10-07T00:00:00.000Z")).hold).toBeNull();
  });

  it("preferences written before holds existed read back without one", () => {
    localStorage.setItem("overview.captureQueue.noAccount", JSON.stringify({ paused: true, folded: false }));
    expect(readCaptureQueuePreferences(null)).toEqual({ paused: true, folded: false, hold: null });
  });
});
