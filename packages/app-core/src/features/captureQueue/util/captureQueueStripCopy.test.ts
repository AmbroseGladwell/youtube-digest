import { describe, expect, it } from "vitest";
import { captureQueueStripCopy } from "./captureQueueStripCopy.js";

describe("captureQueueStripCopy", () => {
  it("words each state as design 27k does", () => {
    expect(
      captureQueueStripCopy(
        { kind: "making", position: 3, total: 12, step: "Writing the overview", title: "The Placebo Paradox", progress: 20, tomorrow: 0 },
        false,
      ),
    ).toEqual({ title: "Making 3 of 12", meta: "Writing the overview · The Placebo Paradox" });
    expect(captureQueueStripCopy({ kind: "paused", waiting: 10 }, false)).toEqual({
      title: "Queue paused",
      meta: "10 waiting · nothing is made until you resume",
    });
    expect(captureQueueStripCopy({ kind: "checked", playlists: 2, queued: 3 }, false)).toEqual({
      title: "Checked 2 playlists",
      meta: "3 new videos queued · starting with the oldest",
    });
    expect(captureQueueStripCopy({ kind: "noKey", waiting: 10 }, false)).toEqual({
      title: "10 videos are waiting for an API key",
      meta: "Nothing can be made without one",
    });
    expect(captureQueueStripCopy({ kind: "attention", failed: 1, skipped: 1 }, false)).toEqual({
      title: "Queue done · 2 need attention",
      meta: "1 failed, 1 skipped",
    });
    expect(captureQueueStripCopy({ kind: "done", made: 12 }, false)).toEqual({ title: "Queue done · 12 made", meta: null });
  });

  it("words a queue waiting on its playlists' paces as design 95ac does, wide and compact", () => {
    const making = { kind: "making" as const, position: 1, total: 3, step: "Writing the overview", title: "How Sleep Cleans the Brain", progress: 54, tomorrow: 214 };
    expect(captureQueueStripCopy(making, false)).toEqual({
      title: "Making 1 of 3",
      meta: "Writing the overview · How Sleep Cleans the Brain",
      after: "· 214 continue tomorrow",
    });
    expect(captureQueueStripCopy(making, true)).toEqual({ title: "Making 1 of 3", meta: "214 continue tomorrow" });
    expect(captureQueueStripCopy({ kind: "doneForToday", tomorrow: 214 }, false)).toEqual({
      title: "Done for today",
      meta: "214 waiting for tomorrow, at each playlist’s pace",
    });
    expect(captureQueueStripCopy({ kind: "doneForToday", tomorrow: 214 }, true)).toEqual({ title: "Done for today", meta: "214 waiting for tomorrow" });
    expect(captureQueueStripCopy({ kind: "waitingForYou", waiting: 12, playlists: ["Saved for later"] }, false)).toEqual({
      title: "Queue done · 12 waiting for you",
      meta: "From Saved for later, made when you choose them",
    });
    expect(captureQueueStripCopy({ kind: "waitingForYou", waiting: 12, playlists: ["Saved for later", "Talks"] }, false).meta).toBe(
      "From 2 playlists, made when you choose them",
    );
  });

  it("waiting at a limit, writes the resume time out, wide and compact", () => {
    const hold = { reason: "serverCap" as const, resumesAt: new Date(2026, 9, 7, 1, 0).getTime() };
    expect(captureQueueStripCopy({ kind: "held", hold, waiting: 9, viaExtension: true, limit: null }, false)).toEqual({
      title: "Waiting for our server",
      meta: "9 waiting · these continue after 01:00, or now with the extension",
    });
    expect(captureQueueStripCopy({ kind: "held", hold, waiting: 9, viaExtension: true, limit: null }, true)).toEqual({
      title: "Waiting · 9 continue after 01:00",
      meta: null,
    });
  });

  it("waiting for the month, says what was made, when it resumes, and whether a key would help", () => {
    const hold = { reason: "monthSpent" as const, resumesAt: new Date(2026, 10, 1, 12).getTime() };
    const limit = {
      quota: "ours" as const,
      made: "5",
      title: "",
      body: "",
      actions: ["addKey" as const, "seePlans" as const],
    };
    expect(captureQueueStripCopy({ kind: "held", hold, waiting: 9, viaExtension: true, limit }, false)).toEqual({
      title: "Queue waiting · 9 videos",
      meta: "This month's 5 are made. Resumes 1 November, or when you add a key.",
    });
    expect(captureQueueStripCopy({ kind: "held", hold, waiting: 9, viaExtension: true, limit }, true)).toEqual({
      title: "Queue waiting · 9",
      meta: "Resumes 1 Nov or with a key",
    });
    const noUpgrade = { ...limit, quota: "both" as const, made: "50 on us and 200 on your own", actions: ["seeUsage" as const] };
    expect(captureQueueStripCopy({ kind: "held", hold, waiting: 1, viaExtension: true, limit: noUpgrade }, false)).toEqual({
      title: "Queue waiting · 1 video",
      meta: "This month's 50 on us and 200 on your own are made. Resumes 1 November.",
    });
  });

  it("compact, folds the detail into the title where the design does", () => {
    expect(captureQueueStripCopy({ kind: "paused", waiting: 10 }, true)).toEqual({ title: "Queue paused · 10 waiting", meta: null });
    expect(captureQueueStripCopy({ kind: "noKey", waiting: 1 }, true)).toEqual({ title: "1 waiting for an API key", meta: null });
  });

  it("one of something is singular", () => {
    expect(captureQueueStripCopy({ kind: "checked", playlists: 1, queued: 1 }, false)).toEqual({
      title: "Checked 1 playlist",
      meta: "1 new video queued · starting with the oldest",
    });
  });
});
