import { describe, expect, it } from "vitest";
import { resumesAtFrom, resumeTimeText, secondsToNextUtcDay } from "./resumeTime.js";

describe("resumeTime", () => {
  it("counts to the next UTC midnight when the server gave no time", () => {
    const now = new Date("2026-10-06T21:30:00.000Z");
    expect(secondsToNextUtcDay(now)).toBe(2.5 * 60 * 60);
    expect(resumesAtFrom(null, now).toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("takes the server's word when it gave one, and never waits more than a day", () => {
    const now = new Date("2026-10-06T21:30:00.000Z");
    expect(resumesAtFrom(600, now).toISOString()).toBe("2026-10-06T21:40:00.000Z");
    expect(resumesAtFrom(10 * 24 * 60 * 60, now).toISOString()).toBe("2026-10-07T21:30:00.000Z");
  });

  it("writes the time out as hours and minutes on a 24-hour clock", () => {
    expect(resumeTimeText(new Date(2026, 9, 7, 1, 0))).toBe("01:00");
    expect(resumeTimeText(new Date(2026, 9, 7, 13, 5))).toBe("13:05");
  });
});
