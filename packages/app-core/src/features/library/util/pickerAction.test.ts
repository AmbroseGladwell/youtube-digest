import { describe, expect, it } from "vitest";
import { pickerAction } from "./pickerAction.js";

describe("pickerAction", () => {
  it("is nothing when the picker changed nothing", () => {
    expect(pickerAction([], 3, "topic")).toBeNull();
  });

  it("is nothing when a place was ticked and unticked back to where it began", () => {
    expect(pickerAction([{ place: "Home", heldBefore: 0, given: false }], 3, "topic")).toBeNull();
    expect(pickerAction([{ place: "Home", heldBefore: 3, given: true }], 3, "topic")).toBeNull();
  });

  it("names the one place that changed", () => {
    expect(pickerAction([{ place: "Home", heldBefore: 1, given: true }], 3, "topic")).toEqual({
      kind: "added",
      overviews: 3,
      place: "Home",
    });
    expect(pickerAction([{ place: "Home", heldBefore: 1, given: false }], 3, "topic")).toEqual({
      kind: "removed",
      overviews: 3,
      place: "Home",
    });
  });

  it("counts the places when more than one changed", () => {
    expect(
      pickerAction(
        [
          { place: "Home", heldBefore: 0, given: true },
          { place: "Money", heldBefore: 2, given: false },
        ],
        3,
        "project",
      ),
    ).toEqual({ kind: "updated", places: 2, noun: "project" });
  });
});
