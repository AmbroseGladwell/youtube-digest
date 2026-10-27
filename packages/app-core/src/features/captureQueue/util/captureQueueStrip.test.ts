import { describe, expect, it } from "vitest";
import { captureQueueStrip, type CaptureQueueStripInput } from "./captureQueueStrip.js";

const idle: CaptureQueueStripInput = {
  making: null,
  waiting: 0,
  ready: 0,
  tomorrow: 0,
  forYou: { waiting: 0, playlists: [] },
  failed: 0,
  skipped: 0,
  paused: false,
  needsKey: false,
  trialSpent: false,
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
      ready: 9,
      batch: { done: 2 },
    });
    expect(strip).toEqual({
      kind: "making",
      position: 3,
      total: 12,
      step: "Writing the overview",
      title: "The Placebo Paradox",
      progress: 21,
      tomorrow: 0,
    });
  });

  it("counts only what can be made today in the batch, and says what continues tomorrow beside it", () => {
    const strip = captureQueueStrip({
      ...idle,
      making: { title: "The Placebo Paradox", step: "Writing the overview", stepProgress: 0 },
      waiting: 216,
      ready: 2,
      tomorrow: 214,
    });
    expect(strip).toMatchObject({ kind: "making", position: 1, total: 3, tomorrow: 214 });
  });

  it("with only paced videos left, is done for today rather than done", () => {
    const paced = { ...idle, waiting: 214, tomorrow: 214, batch: { done: 3 }, notice: { kind: "done" as const, made: 3 } };
    expect(captureQueueStrip(paced)).toEqual({ kind: "doneForToday", tomorrow: 214 });
  });

  it("with only videos waiting for the reader left, says they wait for them, because nothing starts by itself", () => {
    const forYou = { waiting: 12, playlists: ["Saved for later"] };
    expect(captureQueueStrip({ ...idle, waiting: 12, forYou })).toEqual({ kind: "waitingForYou", ...forYou });
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

  it("problems come before what waits for tomorrow, which shows once they are dismissed", () => {
    const done = { ...idle, failed: 1, skipped: 1, batch: { done: 10 }, waiting: 7, tomorrow: 7 };
    expect(captureQueueStrip(done)).toEqual({ kind: "attention", failed: 1, skipped: 1 });
    expect(captureQueueStrip({ ...done, attentionDismissed: true })).toEqual({ kind: "doneForToday", tomorrow: 7 });
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

  it("signed out past the trial, waits for an account before it waits for a key", () => {
    expect(captureQueueStrip({ ...idle, waiting: 4, trialSpent: true, needsKey: true })).toEqual({ kind: "trialSpent", waiting: 4 });
  });
});
