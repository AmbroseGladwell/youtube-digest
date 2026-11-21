import { describe, expect, it } from "vitest";
import { askStatsLine } from "./askStatsLine.js";

describe("askStatsLine", () => {
  it("says how many overviews the answer read of how many, for the library or a project", () => {
    expect(askStatsLine({ overviews: 208, read: 5 }, "library")).toBe("From 5 of your 208 overviews");
    expect(askStatsLine({ overviews: 83, read: 5 }, "project")).toBe("From 5 of this project's 83 overviews");
    expect(askStatsLine({ overviews: 1 }, "project")).toBe("Over this project's 1 overview");
  });
});
