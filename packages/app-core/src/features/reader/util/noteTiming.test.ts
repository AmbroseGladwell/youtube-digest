import { describe, expect, it } from "vitest";
import type { NoteLine } from "../types/NoteLine.js";
import { elapsedSecondsBefore, noteTiming } from "./noteTiming.js";

const body = (text: string): NoteLine => ({
  section: "Summary",
  heading: false,
  bullet: false,
  text,
});

const wordsLine = (count: number) => body(Array.from({ length: count }, () => "word").join(" "));

describe("noteTiming", () => {
  it("derives both times from the note's own words, never from a guess", () => {
    const timing = noteTiming([wordsLine(660)]);

    expect(timing.readMinutes).toBe(3);
    expect(timing.listenMinutes).toBe(4);
  });

  it("rounds a note shorter than a minute up to one, and leaves an empty note at zero", () => {
    expect(noteTiming([wordsLine(12)]).readMinutes).toBe(1);
    expect(noteTiming([]).listenMinutes).toBe(0);
  });

  it("holds a short line for a minimum beat so a three-word heading isn't a flash", () => {
    const timing = noteTiming([body("Key points"), wordsLine(150)]);

    expect(timing.lineSeconds[0]).toBe(1.5);
    expect(timing.lineSeconds[1]).toBe(60);
    expect(timing.totalSeconds).toBe(61.5);
  });
});

describe("elapsedSecondsBefore", () => {
  it("sums the lines already read, and is zero on the first line", () => {
    const timing = noteTiming([wordsLine(150), wordsLine(300), wordsLine(150)]);

    expect(elapsedSecondsBefore(timing, 0)).toBe(0);
    expect(elapsedSecondsBefore(timing, 2)).toBe(180);
  });
});
