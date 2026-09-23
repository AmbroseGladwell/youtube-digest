import { describe, expect, it } from "vitest";
import { OverviewId } from "@overview/domain";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { overviewNeighbours } from "./overviewNeighbours.js";

const ordered = [
  makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" }),
  makeOverviewWithState({ savedAt: "2026-09-15T00:00:00.000Z" }),
  makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" }),
];

describe("overviewNeighbours", () => {
  it("reports the position in the list and the entries either side of it", () => {
    expect(overviewNeighbours(ordered, ordered[1]!.overview.id)).toEqual({
      position: 2,
      total: 3,
      previousId: ordered[0]!.overview.id,
      nextId: ordered[2]!.overview.id,
    });
  });

  it("has no previous at the top of the list and no next at the bottom", () => {
    expect(overviewNeighbours(ordered, ordered[0]!.overview.id).previousId).toBeNull();
    expect(overviewNeighbours(ordered, ordered[2]!.overview.id).nextId).toBeNull();
  });

  it("reports no position for an overview that isn't in the list", () => {
    const missing = OverviewId.parse("99999999-9999-4999-8999-999999999999");

    expect(overviewNeighbours(ordered, missing)).toEqual({
      position: null,
      total: 3,
      previousId: null,
      nextId: null,
    });
  });
});
