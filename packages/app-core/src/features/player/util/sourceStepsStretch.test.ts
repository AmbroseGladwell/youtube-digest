import { describe, expect, it } from "vitest";
import { HOW_TO_APPLY_SECTION, KEY_POINTS_SECTION, SOURCE_STEPS_SECTION, type NoteLine } from "@overview/domain";
import { isInSourceSteps, sourceStepsStretch } from "./sourceStepsStretch.js";

const line = (section: string, heading = false): NoteLine => ({ section, heading, bullet: !heading, text: section });

describe("sourceStepsStretch", () => {
  it("runs from the block's heading up to the section after it", () => {
    const lines = [
      line(KEY_POINTS_SECTION, true),
      line(KEY_POINTS_SECTION),
      line(SOURCE_STEPS_SECTION, true),
      line(SOURCE_STEPS_SECTION),
      line(SOURCE_STEPS_SECTION),
      line(HOW_TO_APPLY_SECTION, true),
    ];
    const stretch = sourceStepsStretch(lines);

    expect(stretch).toEqual({ first: 2, after: 5 });
    expect([1, 2, 4, 5].map((at) => isInSourceSteps(stretch, at))).toEqual([false, true, true, false]);
  });

  it("has nothing after it when the steps end the note, and is null on a note without them", () => {
    expect(sourceStepsStretch([line(SOURCE_STEPS_SECTION, true), line(SOURCE_STEPS_SECTION)])).toEqual({ first: 0, after: null });
    expect(sourceStepsStretch([line(KEY_POINTS_SECTION, true)])).toBeNull();
  });
});
