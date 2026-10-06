import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import {
  makeOverviewWithState,
  makeUnreadableEntry,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { NO_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { matchesLibraryFilters } from "./matchesLibraryFilters.js";

const FITNESS_TOPIC = TopicId.parse("11111111-1111-4111-8111-111111111111");
const FINANCE_TOPIC = TopicId.parse("22222222-2222-4222-8222-222222222222");

describe("matchesLibraryFilters", () => {
  it("matches everything under the default (all) filters", () => {
    const entry = makeOverviewWithState();
    expect(matchesLibraryFilters(entry, NO_LIBRARY_FILTERS)).toBe(true);
  });

  it("filters by topic membership", () => {
    const entry = makeOverviewWithState({ topicIds: [FITNESS_TOPIC] });
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FITNESS_TOPIC })).toBe(true);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FINANCE_TOPIC })).toBe(false);
  });

  it("filters by novelty, and thin overviews with no verdict never match a specific novelty", () => {
    const withVerdict = makeOverviewWithState({
      verdict: { novelty: "original", standsOut: { text: "A new idea.", range: null }, dubious: false, dubiousClaims: [], reasoning: "x", similarTo: [] },
    });
    const thin = makeOverviewWithState({ thin: true, verdict: null });

    expect(matchesLibraryFilters(withVerdict, { ...NO_LIBRARY_FILTERS, novelty: "original" })).toBe(true);
    expect(matchesLibraryFilters(thin, { ...NO_LIBRARY_FILTERS, novelty: "original" })).toBe(false);
  });

  it("filters by favourite, and by the dubious flag on the verdict", () => {
    const favourite = makeOverviewWithState({}, { favourite: true });
    const plain = makeOverviewWithState({}, { favourite: false });
    const dubious = makeOverviewWithState({
      verdict: { novelty: "common_knowledge", standsOut: null, dubious: true, dubiousClaims: null, reasoning: "x", similarTo: [] },
    });
    const sound = makeOverviewWithState({
      verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "x", similarTo: [] },
    });

    expect(matchesLibraryFilters(favourite, { ...NO_LIBRARY_FILTERS, favourite: true })).toBe(true);
    expect(matchesLibraryFilters(plain, { ...NO_LIBRARY_FILTERS, favourite: true })).toBe(false);
    expect(matchesLibraryFilters(dubious, { ...NO_LIBRARY_FILTERS, dubious: true })).toBe(true);
    expect(matchesLibraryFilters(sound, { ...NO_LIBRARY_FILTERS, dubious: true })).toBe(false);
  });

  it("filters by read status", () => {
    const unread = makeOverviewWithState({}, { read: false });
    const read = makeOverviewWithState({}, { read: true });

    expect(matchesLibraryFilters(unread, { ...NO_LIBRARY_FILTERS, status: "unread" })).toBe(true);
    expect(matchesLibraryFilters(unread, { ...NO_LIBRARY_FILTERS, status: "read" })).toBe(false);
    expect(matchesLibraryFilters(read, { ...NO_LIBRARY_FILTERS, status: "read" })).toBe(true);
  });

  it("filters by a case-insensitive search query against the haystack", () => {
    const entry = makeOverviewWithState({ tags: ["platysma"] });
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, query: "PLATYSMA" })).toBe(true);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, query: "keto" })).toBe(false);
  });

  it("combines filters with AND, not OR", () => {
    const entry = makeOverviewWithState({ topicIds: [FITNESS_TOPIC] }, { read: false });
    expect(
      matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FITNESS_TOPIC, status: "read" }),
    ).toBe(false);
  });

  // Read and favourite live in their own store, so they are answerable for a record whose
  // overview is not. Every other filter reads a field of the overview, and including a
  // record that cannot answer would pollute the view
  // (docs/features/record-migrations.md).
  it("keeps an unreadable record under an unfiltered view and under the filters its state can answer", () => {
    const favourited = makeUnreadableEntry({}, { favourite: true });

    expect(matchesLibraryFilters(favourited, NO_LIBRARY_FILTERS)).toBe(true);
    expect(matchesLibraryFilters(favourited, { ...NO_LIBRARY_FILTERS, favourite: true })).toBe(true);
    expect(
      matchesLibraryFilters(makeUnreadableEntry({}, { read: true }), {
        ...NO_LIBRARY_FILTERS,
        status: "unread",
      }),
    ).toBe(false);
  });

  it("drops an unreadable record from every filter that reads the overview itself", () => {
    const entry = makeUnreadableEntry();

    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FITNESS_TOPIC })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, novelty: "original" })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, dubious: true })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, query: "anything" })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, tag: "saas" })).toBe(false);
  });

  it("filters by a tag on the note or one the reader added", () => {
    const tagged = makeOverviewWithState({ tags: ["saas", "pricing"] });
    const userTagged = makeOverviewWithState({ tags: ["energy"] }, { userTags: ["saas"] });
    const other = makeOverviewWithState({ tags: ["energy"] });

    expect(matchesLibraryFilters(tagged, { ...NO_LIBRARY_FILTERS, tag: "saas" })).toBe(true);
    expect(matchesLibraryFilters(userTagged, { ...NO_LIBRARY_FILTERS, tag: "saas" })).toBe(true);
    expect(matchesLibraryFilters(other, { ...NO_LIBRARY_FILTERS, tag: "saas" })).toBe(false);
  });
});
