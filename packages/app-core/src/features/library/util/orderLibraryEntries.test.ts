import { describe, expect, it } from "vitest";
import { makeOverview, makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import { libraryEntrySavedAt, libraryEntryTitle } from "../../overviews/types/LibraryEntry.js";
import { LIBRARY_SORT_PRESET } from "../types/LibrarySort.js";
import { orderLibraryEntries } from "./orderLibraryEntries.js";

const titled = (title: string, savedAt = "2026-09-14T00:00:00.000Z") =>
  makeOverviewWithState({ savedAt, source: { ...makeOverview().source, title } });

describe("orderLibraryEntries", () => {
  it("puts the newest saved first by default order", () => {
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });

    expect(orderLibraryEntries([older, newer], LIBRARY_SORT_PRESET.newest).map(libraryEntrySavedAt)).toEqual([
      "2026-09-16T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    ]);
  });

  it("puts the oldest saved first, with an unreadable record at its salvaged date", () => {
    const newer = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });
    const older = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const between = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-15T00:00:00.000Z", source: null },
    });

    expect(orderLibraryEntries([newer, between, older], LIBRARY_SORT_PRESET.oldest).map(libraryEntrySavedAt)).toEqual([
      "2026-09-14T00:00:00.000Z",
      "2026-09-15T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
    ]);
  });

  it("still sorts a record whose date did not survive last when the oldest come first", () => {
    const dated = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });
    const undated = makeUnreadableEntry({ salvaged: null });

    expect(orderLibraryEntries([undated, dated], LIBRARY_SORT_PRESET.oldest).map(libraryEntrySavedAt)).toEqual([
      "2026-09-14T00:00:00.000Z",
      null,
    ]);
  });

  it("sorts by title ignoring case, with numbers in numeric order", () => {
    const entries = [titled("banana"), titled("Apple"), titled("Part 10"), titled("Part 2")];

    expect(orderLibraryEntries(entries, LIBRARY_SORT_PRESET.title).map(libraryEntryTitle)).toEqual([
      "Apple",
      "banana",
      "Part 2",
      "Part 10",
    ]);
  });

  it("places an unreadable record by its salvaged title, and one without a title last", () => {
    const untitled = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-20T00:00:00.000Z", source: null },
    });
    const salvaged = makeUnreadableEntry({
      salvaged: {
        savedAt: "2026-09-10T00:00:00.000Z",
        source: { kind: "youtube", id: null, url: null, title: "Middle" },
      },
    });

    expect(
      orderLibraryEntries([untitled, titled("Zebra"), salvaged, titled("Aardvark")], LIBRARY_SORT_PRESET.title).map(libraryEntryTitle),
    ).toEqual(["Aardvark", "Middle", "Zebra", null]);
  });

  it("breaks a tie between equal titles by newest saved", () => {
    const older = titled("Same title", "2026-09-14T00:00:00.000Z");
    const newer = titled("Same title", "2026-09-16T00:00:00.000Z");

    expect(orderLibraryEntries([older, newer], LIBRARY_SORT_PRESET.title).map(libraryEntrySavedAt)).toEqual([
      "2026-09-16T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    ]);
  });

  it("leaves the caller's array untouched", () => {
    const entries = [titled("B"), titled("A")];
    const before = [...entries];

    orderLibraryEntries(entries, LIBRARY_SORT_PRESET.title);
    orderLibraryEntries(entries, LIBRARY_SORT_PRESET.oldest);

    expect(entries).toEqual(before);
  });
});

describe("orderLibraryEntries by the other fields and either way", () => {
  const published = (title: string, publishedAt: string | null) =>
    makeOverviewWithState({ source: { ...makeOverview().source, title, publishedAt } });

  it("orders by published date, with no date last whichever way it runs", () => {
    const entries = [published("Middle", "2025-05-01T00:00:00.000Z"), published("None", null), published("Old", "2019-03-01T00:00:00Z")];

    expect(orderLibraryEntries(entries, { field: "published", direction: "desc", group: "none" }).map(libraryEntryTitle)).toEqual([
      "Middle",
      "Old",
      "None",
    ]);
    expect(orderLibraryEntries(entries, { field: "published", direction: "asc", group: "none" }).map(libraryEntryTitle)).toEqual([
      "Old",
      "Middle",
      "None",
    ]);
  });

  it("orders by Updated: the reader's own edit or activity, else when it was saved", () => {
    const edited = makeOverviewWithState({ savedAt: "2026-09-01T00:00:00.000Z", editedAt: "2026-10-05T00:00:00.000Z" });
    const chatted = makeOverviewWithState({ savedAt: "2026-09-02T00:00:00.000Z" });
    const saved = makeOverviewWithState({ savedAt: "2026-10-01T00:00:00.000Z" });
    const activity = new Map([[chatted.overview.id as string, Date.parse("2026-10-10T00:00:00.000Z")]]);

    expect(orderLibraryEntries([saved, edited, chatted], { field: "updated", direction: "desc", group: "none" }, activity)).toEqual([
      chatted,
      edited,
      saved,
    ]);
  });

  it("runs titles Z–A, skipping a leading The", () => {
    const entries = [titled("The Zoo"), titled("Apple"), titled("Mango")];

    expect(orderLibraryEntries(entries, { field: "title", direction: "desc", group: "none" }).map(libraryEntryTitle)).toEqual([
      "The Zoo",
      "Mango",
      "Apple",
    ]);
  });
});
