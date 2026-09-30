import { describe, expect, it } from "vitest";
import { lineAtTime, nearestLineStart } from "./lineAtTime.js";

// Shaped the way services/tts renders a note: the first line at nothing, each later one
// after the speech before it and a 0.4 s gap, headings spoken as lines of their own.
const LINE_STARTS = [0, 1.02, 7.86, 8.91, 12.44, 17.3, 18.2];

describe("lineAtTime", () => {
  it("is the last line to have started, not the nearest", () => {
    expect(lineAtTime(LINE_STARTS, 7.85)).toBe(1);
    expect(lineAtTime(LINE_STARTS, 7.86)).toBe(2);
    expect(lineAtTime(LINE_STARTS, 8.9)).toBe(2);
  });

  it("holds the first line before anything starts, and the last one after it", () => {
    expect(lineAtTime(LINE_STARTS, -1)).toBe(0);
    expect(lineAtTime(LINE_STARTS, 0)).toBe(0);
    expect(lineAtTime(LINE_STARTS, 600)).toBe(6);
  });

  it("is the first line of a note that has none", () => {
    expect(lineAtTime([], 3)).toBe(0);
  });
});

describe("nearestLineStart", () => {
  it("snaps a drag to whichever line start is closer, either side", () => {
    expect(nearestLineStart(LINE_STARTS, 7.5)).toBe(2);
    expect(nearestLineStart(LINE_STARTS, 3)).toBe(1);
    expect(nearestLineStart(LINE_STARTS, 17.8)).toBe(6);
  });
});
