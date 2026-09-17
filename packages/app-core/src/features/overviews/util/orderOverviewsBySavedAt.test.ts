import { describe, expect, it } from "vitest";
import { makeOverviewWithState } from "../types/OverviewFactory.testHelper.js";
import { orderOverviewsBySavedAt } from "./orderOverviewsBySavedAt.js";

describe("orderOverviewsBySavedAt", () => {
  it("puts the newest saved first", () => {
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });

    expect(orderOverviewsBySavedAt([older, newer]).map((entry) => entry.overview.savedAt)).toEqual([
      newer.overview.savedAt,
      older.overview.savedAt,
    ]);
  });

  it("leaves the caller's array untouched", () => {
    const entries = [
      makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" }),
      makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" }),
    ];
    const before = [...entries];

    orderOverviewsBySavedAt(entries);

    expect(entries).toEqual(before);
  });
});
