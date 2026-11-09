import { describe, expect, it } from "vitest";
import { makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import { NO_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { MEANING_RESULTS, meaningEntries } from "./meaningEntries.js";

const searching = { ...NO_LIBRARY_FILTERS, query: "leaders who overstay" };
const matchesFor = (...ids: string[]) => ({ available: true as const, matches: ids.map((overviewId, index) => ({ overviewId, similarity: 0.9 - index / 100 })) });

describe("meaningEntries", () => {
  it("lists the closest matches first, as the server ordered them", () => {
    const first = makeOverviewWithState();
    const second = makeOverviewWithState();
    const result = meaningEntries([second, first], searching, matchesFor(first.overview.id, second.overview.id), new Set());
    expect(result.map((entry) => entry.overview.id)).toEqual([first.overview.id, second.overview.id]);
  });

  it("leaves out an overview a word already matched", () => {
    const byWord = makeOverviewWithState();
    const byMeaning = makeOverviewWithState();
    const result = meaningEntries([byWord, byMeaning], searching, matchesFor(byWord.overview.id, byMeaning.overview.id), new Set([byWord.overview.id]));
    expect(result.map((entry) => entry.overview.id)).toEqual([byMeaning.overview.id]);
  });

  it("keeps the other filters: a match outside them is not shown", () => {
    const unread = makeOverviewWithState();
    const read = makeOverviewWithState({}, { read: true });
    const result = meaningEntries([unread, read], { ...searching, status: "unread" }, matchesFor(read.overview.id, unread.overview.id), new Set());
    expect(result.map((entry) => entry.overview.id)).toEqual([unread.overview.id]);
  });

  it(`shows at most ${MEANING_RESULTS}`, () => {
    const entries = Array.from({ length: MEANING_RESULTS + 3 }, () => makeOverviewWithState());
    const result = meaningEntries(entries, searching, matchesFor(...entries.map((entry) => entry.overview.id)), new Set());
    expect(result).toHaveLength(MEANING_RESULTS);
  });

  it("shows nothing without a search, before an answer, or when meaning was unavailable", () => {
    const entry = makeOverviewWithState();
    const matches = matchesFor(entry.overview.id);
    expect(meaningEntries([entry], NO_LIBRARY_FILTERS, matches, new Set())).toEqual([]);
    expect(meaningEntries([entry], searching, undefined, new Set())).toEqual([]);
    expect(meaningEntries([entry], searching, { available: false }, new Set())).toEqual([]);
  });

  it("never shows an unreadable record, or an id this device doesn't hold", () => {
    const unreadable = makeUnreadableEntry();
    const unreadableId = unreadable.kind === "unreadable" ? unreadable.record.id : "";
    const result = meaningEntries([unreadable], searching, matchesFor(unreadableId, "not-on-this-device"), new Set());
    expect(result).toEqual([]);
  });
});
