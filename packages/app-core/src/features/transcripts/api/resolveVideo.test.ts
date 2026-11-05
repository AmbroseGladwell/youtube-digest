import { describe, expect, it } from "vitest";
import { VideoId, type ClientWarningReport, type TranscriptStore, type VideoSource } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { CaptureStopwatch } from "../../newOverview/api/CaptureStopwatch.js";
import type { TranscriptSource, TranscriptTier } from "../types/TranscriptSource.js";
import { resolveVideo } from "./resolveVideo.js";

const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const video: VideoSource = {
  id: VideoId.parse("dQw4w9WgXcQ"),
  url: URL,
  title: "Example",
  channel: "Example Channel",
  description: null,
  durationMs: null,
  publishedAt: null,
  thumbnailUrl: null,
};
const segments = [{ text: "Hello.", startMs: 0, endMs: 1_000 }];

const emptyStore: TranscriptStore = {
  getTranscript: async () => null,
  saveTranscript: async () => undefined,
  deleteTranscript: async () => undefined,
};

const rung = (tier: TranscriptTier, answer: "answers" | "no-answer" | "throws" | "daily-cap" | "not-ready"): TranscriptSource => ({
  tier,
  cost: "free",
  isReady: async () => answer !== "not-ready",
  resolve: async () => {
    if (answer === "throws") throw new Error("Simulated: the rung failed");
    if (answer === "daily-cap") throw new TranscriptFetchError("Simulated: the cap", { failure: "daily-cap", sourceId: tier });
    return answer === "no-answer" ? null : { video, transcript: segments, generated: false };
  },
});

const resolvingWith = async (sources: TranscriptSource[]) => {
  const warnings: ClientWarningReport[] = [];
  const outcome = await resolveVideo(URL, { sources, transcriptStore: emptyStore, warn: (warning) => warnings.push(warning) }).then(
    () => "resolved",
    () => "failed",
  );
  return { outcome, warnings };
};

describe("resolveVideo's warnings", () => {
  it("says nothing when a rung only had no answer, because that is the ladder working", async () => {
    const { warnings } = await resolvingWith([rung("shared-cache", "no-answer"), rung("extension", "answers")]);

    expect(warnings).toEqual([]);
  });

  it("warns when a rung failed on the way to the one that answered, naming each", async () => {
    const { outcome, warnings } = await resolvingWith([
      rung("shared-cache", "no-answer"),
      rung("extension", "throws"),
      rung("service", "answers"),
    ]);

    expect(outcome).toBe("resolved");
    expect(warnings).toEqual([
      {
        name: "transcriptFellThrough",
        passed: [
          { rung: "shared-cache", outcome: "no-answer" },
          { rung: "extension", outcome: "failed" },
        ],
        answeredBy: "service",
      },
    ]);
  });

  it("warns with no rung answering when none did", async () => {
    const { outcome, warnings } = await resolvingWith([rung("shared-cache", "no-answer"), rung("extension", "no-answer")]);

    expect(outcome).toBe("failed");
    expect(warnings).toEqual([expect.objectContaining({ name: "transcriptFellThrough", answeredBy: null })]);
  });

  it("says why each rung failed when it named a reason, so a queue failure can be traced without the server's logs", async () => {
    const { outcome, warnings } = await resolvingWith([rung("shared-cache", "no-answer"), rung("service", "daily-cap")]);

    expect(outcome).toBe("failed");
    expect(warnings).toEqual([
      {
        name: "transcriptFellThrough",
        passed: [
          { rung: "shared-cache", outcome: "no-answer" },
          { rung: "service", outcome: "failed", failure: "daily-cap" },
        ],
        answeredBy: null,
      },
    ]);
  });
});

describe("resolveVideo's timing", () => {
  it("times the store's read and each rung asked, as it found them, and nothing it never reached", async () => {
    let clock = 0;
    const stopwatch = new CaptureStopwatch(() => clock);
    const slow = (source: TranscriptSource, ms: number): TranscriptSource => ({
      ...source,
      resolve: (...args) => {
        clock += ms;
        return source.resolve(...args);
      },
    });

    await resolveVideo(URL, {
      sources: [rung("shared-cache", "not-ready"), slow(rung("extension", "throws"), 1_200), slow(rung("service", "answers"), 2_900)],
      transcriptStore: emptyStore,
      stopwatch,
    });

    expect(stopwatch.report("finished", 0).steps).toEqual([
      { step: "stored", outcome: "no-answer", ms: 0 },
      { step: "shared-cache", outcome: "unavailable", ms: 0 },
      { step: "extension", outcome: "failed", ms: 1_200 },
      { step: "service", outcome: "answered", ms: 2_900 },
    ]);
  });

  it("asks the rungs the same way with no stopwatch, as the background prefetch does", async () => {
    const { outcome, warnings } = await resolvingWith([rung("shared-cache", "not-ready"), rung("extension", "answers")]);

    expect(outcome).toBe("resolved");
    expect(warnings).toEqual([]);
  });
});
