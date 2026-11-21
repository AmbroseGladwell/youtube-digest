import { describe, expect, it } from "vitest";
import { scriptLineIndex, WAIT_BAR_CREEP_END, WAIT_BAR_START, waitBarFraction, waitEstimateLine } from "./waitTimeline.js";

describe("waitBarFraction", () => {
  const running = { phase: "running" as const, expectedSeconds: 120, doneStages: 0 };

  it("starts part-filled", () => {
    expect(waitBarFraction({ ...running, elapsedSeconds: 0 })).toBe(WAIT_BAR_START);
  });

  it("moves to about 40% once the first stage is done", () => {
    expect(waitBarFraction({ ...running, elapsedSeconds: 1, doneStages: 1 })).toBeCloseTo(0.4, 2);
  });

  it("creeps with the time but never completes while running", () => {
    expect(waitBarFraction({ ...running, elapsedSeconds: 60 })).toBeCloseTo(0.6, 2);
    expect(waitBarFraction({ ...running, elapsedSeconds: 600 })).toBe(WAIT_BAR_CREEP_END);
    expect(waitBarFraction({ ...running, elapsedSeconds: 600, doneStages: 9 })).toBe(WAIT_BAR_CREEP_END);
  });

  it("completes only when ready", () => {
    expect(waitBarFraction({ ...running, phase: "ready", elapsedSeconds: 5 })).toBe(1);
  });
});

describe("waitEstimateLine", () => {
  const running = { phase: "running" as const, expectedSeconds: 120 };

  it("counts down whole minutes from the expected time", () => {
    expect(waitEstimateLine({ ...running, elapsedSeconds: 0 })).toBe("About 2 minutes left");
    expect(waitEstimateLine({ ...running, elapsedSeconds: 61 })).toBe("About 1 minute left");
    expect(waitEstimateLine({ ...running, expectedSeconds: 240, elapsedSeconds: 0 })).toBe("About 4 minutes left");
  });

  it("says ready in a moment near the end and past it", () => {
    expect(waitEstimateLine({ ...running, elapsedSeconds: 90 })).toBe("Ready in a moment");
    expect(waitEstimateLine({ ...running, elapsedSeconds: 500 })).toBe("Ready in a moment");
  });

  it("says ready when it is", () => {
    expect(waitEstimateLine({ ...running, phase: "ready", elapsedSeconds: 10 })).toBe("Ready");
  });
});

describe("scriptLineIndex", () => {
  it("spreads the lines across the stage and holds the last", () => {
    expect(scriptLineIndex(5, 0, 100)).toBe(0);
    expect(scriptLineIndex(5, 19, 100)).toBe(0);
    expect(scriptLineIndex(5, 20, 100)).toBe(1);
    expect(scriptLineIndex(5, 99, 100)).toBe(4);
    expect(scriptLineIndex(5, 1000, 100)).toBe(4);
  });

  it("has no line to show for an empty script", () => {
    expect(scriptLineIndex(0, 10, 100)).toBe(-1);
  });
});
