import { describe, expect, it } from "vitest";
import { captureQueueStripCopy } from "./captureQueueStripCopy.js";

describe("captureQueueStripCopy", () => {
  it("words each state as design 27k does", () => {
    expect(
      captureQueueStripCopy({ kind: "making", position: 3, total: 12, step: "Writing the overview", title: "The Placebo Paradox", progress: 20 }, false),
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
