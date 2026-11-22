import { describe, expect, it } from "vitest";
import { lineAtTime, nearestLineStart } from "./lineAtTime.js";

const LINE_STARTS_AS_TTS_RENDERS_THEM = [0, 1.02, 7.86, 8.91, 12.44, 17.3, 18.2];

describe("lineAtTime", () => {
  it("is the last line to have started, not the nearest", () => {
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, 7.85)).toBe(1);
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, 7.86)).toBe(2);
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, 8.9)).toBe(2);
  });

  it("holds the first line before anything starts, and the last one after it", () => {
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, -1)).toBe(0);
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, 0)).toBe(0);
    expect(lineAtTime(LINE_STARTS_AS_TTS_RENDERS_THEM, 600)).toBe(6);
  });

  it("is the first line of a note that has none", () => {
    expect(lineAtTime([], 3)).toBe(0);
  });
});

describe("nearestLineStart", () => {
  it("snaps a drag to whichever line start is closer, either side", () => {
    expect(nearestLineStart(LINE_STARTS_AS_TTS_RENDERS_THEM, 7.5)).toBe(2);
    expect(nearestLineStart(LINE_STARTS_AS_TTS_RENDERS_THEM, 3)).toBe(1);
    expect(nearestLineStart(LINE_STARTS_AS_TTS_RENDERS_THEM, 17.8)).toBe(6);
  });
});
