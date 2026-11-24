import { describe, expect, it } from "vitest";
import { madeLaterOf } from "./madeLaterOf.js";

describe("madeLaterOf", () => {
  it("counts whole hours waited, and a new UTC month as a reset", () => {
    expect(madeLaterOf("2026-11-30T22:30:00.000Z", new Date("2026-12-01T01:10:00.000Z"))).toEqual({ waitedHours: 2, after: "reset" });
  });

  it("calls it the same month when more overviews came before the reset", () => {
    expect(madeLaterOf("2026-11-03T09:00:00.000Z", new Date("2026-11-03T09:20:00.000Z"))).toEqual({ waitedHours: 0, after: "sameMonth" });
  });
});
