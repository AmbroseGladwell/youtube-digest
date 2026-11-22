import { describe, expect, it } from "vitest";
import { buildSearchHaystack } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { searchHaystackOf } from "./searchHaystackOf.js";

describe("searchHaystackOf", () => {
  it("reads the same text the domain builds", () => {
    const overview = makeOverview();
    expect(searchHaystackOf(overview)).toBe(buildSearchHaystack(overview));
  });

  it("builds a changed overview afresh, since a change is a new record", () => {
    const overview = makeOverview({ coreClaim: "Before" });
    searchHaystackOf(overview);
    const changed = { ...overview, coreClaim: "After" };
    expect(searchHaystackOf(changed)).toContain("after");
  });
});
