import { describe, expect, it } from "vitest";
import { CaptureStopwatch } from "./CaptureStopwatch.js";

const ticking = (...readings: number[]) => {
  let at = 0;
  return () => readings[at++] ?? readings.at(-1)!;
};

describe("CaptureStopwatch", () => {
  it("measures each step between its own two readings, and the whole from the first", async () => {
    const stopwatch = new CaptureStopwatch(ticking(1_000, 1_000, 1_310, 1_310, 42_310, 42_320));

    await stopwatch.time("shared-cache", async () => null, () => "no-answer");
    await stopwatch.time("model", async () => "note");

    expect(stopwatch.report("finished", 18_400)).toEqual({
      name: "captureTimed",
      outcome: "finished",
      steps: [
        { step: "shared-cache", outcome: "no-answer", ms: 310 },
        { step: "model", outcome: "answered", ms: 41_000 },
      ],
      totalMs: 41_320,
      transcriptCharacters: 18_400,
    });
  });

  it("marks a step that threw as failed, with how long it took to, and lets the error through", async () => {
    const stopwatch = new CaptureStopwatch(ticking(0, 0, 2_900));

    await expect(stopwatch.time("service", async () => Promise.reject(new Error("Simulated: blocked")))).rejects.toThrow("blocked");

    expect(stopwatch.report("failed", 0).steps).toEqual([{ step: "service", outcome: "failed", ms: 2_900 }]);
  });

  it("has no entry for a step never begun, rather than a zero", () => {
    const stopwatch = new CaptureStopwatch(ticking(0, 5));

    expect(stopwatch.report("cancelled", 0)).toEqual(expect.objectContaining({ steps: [], totalMs: 5 }));
  });
});
