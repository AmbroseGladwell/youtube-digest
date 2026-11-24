import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { libraryKindsOf } from "./libraryKindsOf.js";

describe("libraryKindsOf", () => {
  it("is the medium alone for an overview that isn't a recipe", () => {
    expect(libraryKindsOf(makeOverview())).toEqual(["video"]);
  });

  it("is the medium and Recipe for a recipe", () => {
    expect(libraryKindsOf(makeOverview({ recipe: {} as never }))).toEqual(["video", "recipe"]);
  });
});
