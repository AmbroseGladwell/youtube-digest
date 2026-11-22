import { describe, expect, it } from "vitest";
import { askStatsLine } from "./askStatsLine.js";

describe("askStatsLine", () => {
  it("says how many overviews the answer read of how many, for the library or a project", () => {
    expect(askStatsLine({ overviews: 208, read: 5 }, "library")).toBe("From 5 of your 208 overviews");
    expect(askStatsLine({ overviews: 83, read: 5 }, "project")).toBe("From 5 of this project's 83 overviews");
    expect(askStatsLine({ overviews: 1 }, "project")).toBe("Over this project's 1 overview");
  });

  it("says what a planned answer looked across, and how many it read in full (OV-373)", () => {
    expect(askStatsLine({ overviews: 223, read: 5, looked: 112 }, "library")).toBe(
      "Looked across 112 of your 223 overviews · read 5 in full",
    );
    expect(askStatsLine({ overviews: 83, read: 3, looked: 83 }, "project")).toBe(
      "Looked across this project's 83 overviews · read 3 in full",
    );
    expect(askStatsLine({ overviews: 223, read: 0, looked: 0 }, "library")).toBe("Looked across 0 of your 223 overviews");
  });
});
