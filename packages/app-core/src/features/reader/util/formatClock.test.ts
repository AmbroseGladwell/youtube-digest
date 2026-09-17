import { describe, expect, it } from "vitest";
import { formatClock } from "./formatClock.js";

describe("formatClock", () => {
  it("pads the seconds and drops the hour when there isn't one", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(698)).toBe("11:38");
  });

  it("shows hours once past one, padding the minutes", () => {
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("never renders a negative clock", () => {
    expect(formatClock(-5)).toBe("0:00");
  });
});
