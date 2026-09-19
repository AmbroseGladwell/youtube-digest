import type { RunReport } from "@overview/app-core";
import { OverviewId, VideoId } from "@overview/types";
import { describe, expect, it } from "vitest";
import { overviewButtonState } from "./overviewButtonState.js";

const VIDEO_ID = "watchedVideo1";

const reportOn = (videoId: string | null, overrides: Partial<RunReport> = {}): RunReport => ({
  videoId: videoId === null ? null : VideoId.parse(videoId),
  videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  startedAt: 1_000_000,
  status: "running",
  progressFraction: 0.25,
  overviewId: null,
  ...overrides,
});

describe("overviewButtonState", () => {
  it("offers the run when nothing is going and nothing is held", () => {
    expect(overviewButtonState({ videoId: VIDEO_ID, report: null, held: false })).toEqual({
      kind: "idle",
      startedAt: null,
      progressFraction: 0,
    });
  });

  it("reports a run on this video, with the run's own start and progress", () => {
    const state = overviewButtonState({
      videoId: VIDEO_ID,
      report: reportOn(VIDEO_ID),
      held: false,
    });

    expect(state).toEqual({ kind: "generating", startedAt: 1_000_000, progressFraction: 0.25 });
  });

  // The panel follows the tab in front of it, so the run it is reporting is often for a
  // different video than the one this button is sitting on.
  it("ignores a run on another video", () => {
    const state = overviewButtonState({
      videoId: VIDEO_ID,
      report: reportOn("someOtherVideo"),
      held: false,
    });

    expect(state.kind).toBe("idle");
  });

  it("ignores a run whose video is not resolved yet", () => {
    expect(
      overviewButtonState({ videoId: VIDEO_ID, report: reportOn(null), held: false }).kind,
    ).toBe("idle");
  });

  it("is ready when the run it was watching finished", () => {
    const report = reportOn(VIDEO_ID, {
      status: "ready",
      progressFraction: 1,
      overviewId: OverviewId.parse(crypto.randomUUID()),
    });

    expect(overviewButtonState({ videoId: VIDEO_ID, report, held: false }).kind).toBe("ready");
  });

  // Without this the button would say "Overview" on a video already written up, which
  // makes it a one-press way to pay for the same video twice.
  it("is ready on arrival at a video the library already holds", () => {
    expect(overviewButtonState({ videoId: VIDEO_ID, report: null, held: true }).kind).toBe("ready");
  });

  // The panel carries the error, where it can actually be read.
  it("goes back to offering a run after one fails", () => {
    const report = reportOn(VIDEO_ID, { status: "failed" });

    expect(overviewButtonState({ videoId: VIDEO_ID, report, held: false }).kind).toBe("idle");
  });

  it("still offers the held overview when a run on another video fails", () => {
    const report = reportOn("someOtherVideo", { status: "failed" });

    expect(overviewButtonState({ videoId: VIDEO_ID, report, held: true }).kind).toBe("ready");
  });
});
