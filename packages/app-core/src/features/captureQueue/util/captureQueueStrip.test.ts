import { describe, expect, it } from "vitest";
import { captureQueueStrip, type CaptureQueueStripInput } from "./captureQueueStrip.js";

const idle: CaptureQueueStripInput = {
  making: null,
  waiting: 0,
  failed: 0,
  skipped: 0,
  paused: false,
  needsKey: false,
  hold: null,
  viaExtension: true,
  batch: null,
  notice: null,
  attentionDismissed: false,
};

describe("captureQueueStrip", () => {
  it("says nothing when the queue has nothing to say", () => {
    expect(captureQueueStrip(idle)).toBeNull();
  });

  it("counts the video being made among this run's batch: done, this one, and what waits", () => {
    const strip = captureQueueStrip({
      ...idle,
      making: { title: "The Placebo Paradox", step: "Writing the overview", stepProgress: 0.5 },
      waiting: 9,
      batch: { done: 2 },
    });
    expect(strip).toEqual({
      kind: "making",
      position: 3,
      total: 12,
      step: "Writing the overview",
      title: "The Placebo Paradox",
      progress: 21,
    });
  });

  it("with no API key, says what is waiting for one rather than seeming to work", () => {
    expect(captureQueueStrip({ ...idle, waiting: 10, needsKey: true, paused: true })).toEqual({ kind: "noKey", waiting: 10 });
  });

  it("paused, says how many wait", () => {
    expect(captureQueueStrip({ ...idle, waiting: 10, paused: true })).toEqual({ kind: "paused", waiting: 10 });
  });

  it("waiting at our server's cap, says so with when it resumes, and the reader's pause still wins", () => {
    const hold = { reason: "serverCap" as const, resumesAt: Date.parse("2026-10-07T00:00:00.000Z") };
    expect(captureQueueStrip({ ...idle, waiting: 9, hold })).toEqual({ kind: "held", hold, waiting: 9, viaExtension: true });
    expect(captureQueueStrip({ ...idle, waiting: 9, hold, paused: true })).toEqual({ kind: "paused", waiting: 9 });
    expect(captureQueueStrip({ ...idle, waiting: 0, hold })).toBeNull();
  });

  it("once the queue empties with problems, says how many need attention until dismissed", () => {
    const done = { ...idle, failed: 1, skipped: 1, batch: { done: 10 } };
    expect(captureQueueStrip(done)).toEqual({ kind: "attention", failed: 1, skipped: 1 });
    expect(captureQueueStrip({ ...done, attentionDismissed: true })).toBeNull();
  });

  it("problems left from before this run don't announce themselves on opening", () => {
    expect(captureQueueStrip({ ...idle, failed: 2 })).toBeNull();
  });

  it("a clean finish says how many were made", () => {
    expect(captureQueueStrip({ ...idle, batch: { done: 12 }, notice: { kind: "done", made: 12 } })).toEqual({ kind: "done", made: 12 });
  });

  it("checking on opening says what it found, before anything starts", () => {
    expect(captureQueueStrip({ ...idle, notice: { kind: "checked", playlists: 2, queued: 3 } })).toEqual({
      kind: "checked",
      playlists: 2,
      queued: 3,
    });
  });
});
