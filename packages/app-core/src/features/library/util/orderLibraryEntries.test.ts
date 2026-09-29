import { describe, expect, it } from "vitest";
import {
  makeOverview,
  makeOverviewWithState,
  makeUnreadableEntry,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { libraryEntrySavedAt, libraryEntryTitle } from "../../overviews/types/LibraryEntry.js";
import { orderLibraryEntries } from "./orderLibraryEntries.js";

const titled = (title: string, savedAt = "2026-09-14T00:00:00.000Z") =>
  makeOverviewWithState({ savedAt, video: { ...makeOverview().video, title } });

describe("orderLibraryEntries", () => {
  it("puts the newest saved first by default order", () => {
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });

    expect(orderLibraryEntries([older, newer], "newest").map(libraryEntrySavedAt)).toEqual([
      "2026-09-16T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    ]);
  });

  it("puts the oldest saved first, with an unreadable record at its salvaged date", () => {
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const between = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-15T00:00:00.000Z", video: null },
    });

    expect(orderLibraryEntries([newer, between, older], "oldest").map(libraryEntrySavedAt)).toEqual([
      "2026-09-14T00:00:00.000Z",
      "2026-09-15T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
    ]);
  });

  it("still sorts a record whose date did not survive last when the oldest come first", () => {
    const dated = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const undated = makeUnreadableEntry({ salvaged: null });

    expect(orderLibraryEntries([undated, dated], "oldest").map(libraryEntrySavedAt)).toEqual([
      "2026-09-14T00:00:00.000Z",
      null,
    ]);
  });

  it("sorts by title ignoring case, with numbers in numeric order", () => {
    const entries = [titled("banana"), titled("Apple"), titled("Part 10"), titled("Part 2")];

    expect(orderLibraryEntries(entries, "title").map(libraryEntryTitle)).toEqual([
      "Apple",
      "banana",
      "Part 2",
      "Part 10",
    ]);
  });

  it("places an unreadable record by its salvaged title, and one without a title last", () => {
    const untitled = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-20T00:00:00.000Z", video: null },
    });
    const salvaged = makeUnreadableEntry({
      salvaged: {
        savedAt: "2026-09-10T00:00:00.000Z",
        video: { id: null, url: null, title: "Middle" },
      },
    });

    expect(
      orderLibraryEntries([untitled, titled("Zebra"), salvaged, titled("Aardvark")], "title").map(
        libraryEntryTitle,
      ),
    ).toEqual(["Aardvark", "Middle", "Zebra", null]);
  });

  it("breaks a tie between equal titles by newest saved", () => {
    const older = titled("Same title", "2026-09-14T00:00:00.000Z");
    const newer = titled("Same title", "2026-09-16T00:00:00.000Z");

    expect(orderLibraryEntries([older, newer], "title").map(libraryEntrySavedAt)).toEqual([
      "2026-09-16T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    ]);
  });

  it("leaves the caller's array untouched", () => {
    const entries = [titled("B"), titled("A")];
    const before = [...entries];

    orderLibraryEntries(entries, "title");
    orderLibraryEntries(entries, "oldest");

    expect(entries).toEqual(before);
  });
});
