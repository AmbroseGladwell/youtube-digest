import { describe, expect, it } from "vitest";
import { formatTimeRange } from "./formatTimeRange.js";

describe("formatTimeRange", () => {
  it("formats sub-hour ranges as m:ss", () => {
    expect(formatTimeRange(135_000, 220_000)).toBe("2:15–3:40");
  });

  it("pads single-digit seconds", () => {
    expect(formatTimeRange(65_000, 69_000)).toBe("1:05–1:09");
  });

  it("switches to h:mm:ss once past an hour", () => {
    expect(formatTimeRange(3_661_000, 3_725_000)).toBe("1:01:01–1:02:05");
  });

  it("floors sub-second precision", () => {
    expect(formatTimeRange(1_999, 2_001)).toBe("0:01–0:02");
  });
});
