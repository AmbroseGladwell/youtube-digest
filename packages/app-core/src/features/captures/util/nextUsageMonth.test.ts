import { describe, expect, it } from "vitest";
import { nextUsageMonth } from "./nextUsageMonth.js";

describe("nextUsageMonth", () => {
  it("is the first of the next UTC month, across a year's end", () => {
    expect(nextUsageMonth(new Date("2026-11-30T23:30:00.000Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextUsageMonth(new Date("2026-12-14T09:00:00.000Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
