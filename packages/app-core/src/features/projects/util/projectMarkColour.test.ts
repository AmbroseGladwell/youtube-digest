import { describe, expect, it } from "vitest";
import { projectMarkColour } from "./projectMarkColour.js";

describe("projectMarkColour", () => {
  it("gives a project the same mark every time", () => {
    expect(projectMarkColour("prj_kitchen")).toBe(projectMarkColour("prj_kitchen"));
  });

  it("only ever names one of the six marks", () => {
    const ids = ["a", "bb", "prj_1", "prj_2", "prj_3", "prj_4", "prj_5", "prj_6", "prj_7"];
    for (const id of ids) {
      expect(projectMarkColour(id)).toMatch(/^var\(--project-mark-[1-6]\)$/);
    }
  });
});
