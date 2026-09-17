import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/types";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { matchesLibraryFilters } from "./matchesLibraryFilters.js";

const FITNESS_TOPIC = TopicId.parse("11111111-1111-4111-8111-111111111111");
const FINANCE_TOPIC = TopicId.parse("22222222-2222-4222-8222-222222222222");

describe("matchesLibraryFilters", () => {
  it("matches everything under the default (all) filters", () => {
    const entry = makeOverviewWithState();
    expect(matchesLibraryFilters(entry, DEFAULT_LIBRARY_FILTERS)).toBe(true);
  });

  it("filters by topic membership", () => {
    const entry = makeOverviewWithState({ topicIds: [FITNESS_TOPIC] });
    expect(matchesLibraryFilters(entry, { ...DEFAULT_LIBRARY_FILTERS, topicId: FITNESS_TOPIC })).toBe(true);
    expect(matchesLibraryFilters(entry, { ...DEFAULT_LIBRARY_FILTERS, topicId: FINANCE_TOPIC })).toBe(false);
  });

  it("filters by novelty, and thin overviews with no verdict never match a specific novelty", () => {
    const withVerdict = makeOverviewWithState({
      verdict: { novelty: "novel", dubious: false, reasoning: "x", similarTo: [] },
    });
    const thin = makeOverviewWithState({ thin: true, verdict: null });

    expect(matchesLibraryFilters(withVerdict, { ...DEFAULT_LIBRARY_FILTERS, novelty: "novel" })).toBe(true);
    expect(matchesLibraryFilters(thin, { ...DEFAULT_LIBRARY_FILTERS, novelty: "novel" })).toBe(false);
  });

  it("filters by favourite, and by the dubious flag on the verdict", () => {
    const favourite = makeOverviewWithState({}, { favourite: true });
    const plain = makeOverviewWithState({}, { favourite: false });
    const dubious = makeOverviewWithState({
      verdict: { novelty: "recycled", dubious: true, reasoning: "x", similarTo: [] },
    });
    const sound = makeOverviewWithState({
      verdict: { novelty: "recycled", dubious: false, reasoning: "x", similarTo: [] },
    });

    expect(matchesLibraryFilters(favourite, { ...DEFAULT_LIBRARY_FILTERS, favourite: true })).toBe(true);
    expect(matchesLibraryFilters(plain, { ...DEFAULT_LIBRARY_FILTERS, favourite: true })).toBe(false);
    expect(matchesLibraryFilters(dubious, { ...DEFAULT_LIBRARY_FILTERS, dubious: true })).toBe(true);
    expect(matchesLibraryFilters(sound, { ...DEFAULT_LIBRARY_FILTERS, dubious: true })).toBe(false);
  });

  it("filters by read status", () => {
    const unread = makeOverviewWithState({}, { read: false });
    const read = makeOverviewWithState({}, { read: true });

    expect(matchesLibraryFilters(unread, { ...DEFAULT_LIBRARY_FILTERS, status: "unread" })).toBe(true);
    expect(matchesLibraryFilters(unread, { ...DEFAULT_LIBRARY_FILTERS, status: "read" })).toBe(false);
    expect(matchesLibraryFilters(read, { ...DEFAULT_LIBRARY_FILTERS, status: "read" })).toBe(true);
  });

  it("filters by a case-insensitive search query against the haystack", () => {
    const entry = makeOverviewWithState({ tags: ["platysma"] });
    expect(matchesLibraryFilters(entry, { ...DEFAULT_LIBRARY_FILTERS, query: "PLATYSMA" })).toBe(true);
    expect(matchesLibraryFilters(entry, { ...DEFAULT_LIBRARY_FILTERS, query: "keto" })).toBe(false);
  });

  it("combines filters with AND, not OR", () => {
    const entry = makeOverviewWithState({ topicIds: [FITNESS_TOPIC] }, { read: false });
    expect(
      matchesLibraryFilters(entry, { ...DEFAULT_LIBRARY_FILTERS, topicId: FITNESS_TOPIC, status: "read" }),
    ).toBe(false);
  });
});
