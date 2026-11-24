import { describe, expect, it } from "vitest";
import { makeOverview, makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import type { LibrarySort } from "../types/LibrarySort.js";
import { libraryGroups, localeWeekStart } from "./libraryGroups.js";
import { orderLibraryEntries } from "./orderLibraryEntries.js";

const NOW = new Date(2026, 10, 26, 15, 0);
const MONDAY = { now: NOW, weekStartsOn: 1 };
const saved = (date: Date) => makeOverviewWithState({ savedAt: date.toISOString() });

const headings = (sort: LibrarySort, entries: ReturnType<typeof saved>[], clock = MONDAY) =>
  libraryGroups(orderLibraryEntries(entries, sort), sort, clock).map(({ heading, entries: run }) => `${heading} ${run.length}`);

describe("libraryGroups", () => {
  it("has no groups when the list isn't grouped", () => {
    expect(libraryGroups([saved(NOW)], { field: "added", direction: "desc", group: "none" }, MONDAY)).toEqual([]);
  });

  it("groups by day: today, yesterday, a weekday this week, then the date, with the year once it isn't this year", () => {
    const entries = [
      saved(new Date(2026, 10, 26, 1, 0)),
      saved(new Date(2026, 10, 25, 23, 0)),
      saved(new Date(2026, 10, 24, 9, 0)),
      saved(new Date(2026, 10, 21, 9, 0)),
      saved(new Date(2025, 2, 7, 9, 0)),
    ];
    expect(headings({ field: "added", direction: "desc", group: "day" }, entries)).toEqual([
      "Today 1",
      "Yesterday 1",
      "Tuesday 1",
      "Saturday 21 Nov 1",
      "Friday 7 Mar 2025 1",
    ]);
  });

  it("starts the week where the locale does", () => {
    const sunday = saved(new Date(2026, 10, 22, 9, 0));
    expect(headings({ field: "added", direction: "desc", group: "week" }, [sunday])).toEqual(["Last week 1"]);
    expect(headings({ field: "added", direction: "desc", group: "week" }, [sunday], { now: NOW, weekStartsOn: 0 })).toEqual([
      "This week 1",
    ]);
  });

  it("groups by week and by month, with the year once it isn't this year", () => {
    const entries = [
      saved(new Date(2026, 10, 25)),
      saved(new Date(2026, 10, 18)),
      saved(new Date(2026, 10, 3)),
      saved(new Date(2019, 2, 4)),
    ];
    expect(headings({ field: "added", direction: "desc", group: "week" }, entries)).toEqual([
      "This week 1",
      "Last week 1",
      "Week of 2 Nov 1",
      "Week of 4 Mar 2019 1",
    ]);
    expect(headings({ field: "added", direction: "desc", group: "month" }, entries)).toEqual(["This month 3", "March 2019 1"]);
  });

  it("puts No date last whichever way the list runs", () => {
    const entries = [
      makeOverviewWithState({ source: { ...makeOverview().source, publishedAt: "2026-11-02T00:00:00.000Z" } }),
      makeOverviewWithState({ source: { ...makeOverview().source, publishedAt: null } }),
      makeOverviewWithState({ source: { ...makeOverview().source, publishedAt: "2026-03-02T00:00:00.000Z" } }),
    ];
    expect(headings({ field: "published", direction: "asc", group: "month" }, entries)).toEqual(["March 1", "This month 1", "No date 1"]);
  });

  it("groups titles by letter, skipping a leading The, with anything else under #", () => {
    const titled = (title: string) => makeOverviewWithState({ source: { ...makeOverview().source, title } });
    const entries = [titled("The Apple"), titled("avocado"), titled("Banana"), titled("10 tips"), makeUnreadableEntry({ salvaged: null })];
    expect(headings({ field: "title", direction: "asc", group: "letter" }, entries as never)).toEqual(["# 1", "A 2", "B 1", "No title 1"]);
  });
});

describe("localeWeekStart", () => {
  it("is Monday in Britain and Sunday in the US", () => {
    expect(localeWeekStart("en-GB")).toBe(1);
    expect(localeWeekStart("en-US")).toBe(0);
  });
});
