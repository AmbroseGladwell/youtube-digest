import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./formatTimestamp.js";

describe("formatTimestamp", () => {
  it("formats a millisecond offset as a clock", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(135_000)).toBe("2:15");
    expect(formatTimestamp(3_661_000)).toBe("1:01:01");
  });

  it("floors sub-second precision rather than rounding past the moment", () => {
    expect(formatTimestamp(1_999)).toBe("0:01");
  });
});
