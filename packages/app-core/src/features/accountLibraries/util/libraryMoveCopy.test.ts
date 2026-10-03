import { describe, expect, it } from "vitest";
import { libraryMoveCopy } from "./libraryMoveCopy.js";

describe("libraryMoveCopy", () => {
  it("says what was added, then what the account already had (47e-1)", () => {
    expect(libraryMoveCopy({ moved: 12, alreadyThere: 2 })).toEqual({
      lead: "12 Overviews added to your account.",
      then: "2 were already there, so we kept your existing versions.",
    });
  });

  it("says only what was added when nothing clashed", () => {
    expect(libraryMoveCopy({ moved: 1, alreadyThere: 0 })).toEqual({
      lead: "1 Overview added to your account.",
      then: null,
    });
  });

  it("never says added when nothing was (47e-2)", () => {
    expect(libraryMoveCopy({ moved: 0, alreadyThere: 4 })).toEqual({
      lead: "4 Overviews were already in your account, so we kept your existing versions.",
      then: null,
    });
    expect(libraryMoveCopy({ moved: 0, alreadyThere: 1 }).lead).toBe(
      "1 Overview was already in your account, so we kept your existing version.",
    );
  });
});
