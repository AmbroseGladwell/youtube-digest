import { describe, expect, it } from "vitest";
import {
  makeOverviewWithState,
  makeUnreadableEntry,
} from "../types/OverviewFactory.testHelper.js";
import { libraryEntrySavedAt } from "../types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "./orderLibraryEntriesBySavedAt.js";

describe("orderLibraryEntriesBySavedAt", () => {
  it("puts the newest saved first", () => {
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });

    expect(
      orderLibraryEntriesBySavedAt([older, newer]).map((entry) => entry.overview.savedAt),
    ).toEqual([newer.overview.savedAt, older.overview.savedAt]);
  });

  it("leaves the caller's array untouched", () => {
    const entries = [
      makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" }),
      makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" }),
    ];
    const before = [...entries];

    orderLibraryEntriesBySavedAt(entries);

    expect(entries).toEqual(before);
  });

  it("sits an unreadable record where its salvaged date puts it, not at either end", () => {
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const between = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-15T00:00:00.000Z", video: null },
    });

    expect(
      orderLibraryEntriesBySavedAt([older, between, newer]).map(libraryEntrySavedAt),
    ).toEqual(["2026-09-16T00:00:00.000Z", "2026-09-15T00:00:00.000Z", "2026-09-14T00:00:00.000Z"]);
  });

  it("sorts a record whose date did not survive last, because it cannot claim a position", () => {
    const dated = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const undated = makeUnreadableEntry({ salvaged: null });

    expect(orderLibraryEntriesBySavedAt([undated, dated]).map(libraryEntrySavedAt)).toEqual([
      "2026-09-14T00:00:00.000Z",
      null,
    ]);
  });
});
