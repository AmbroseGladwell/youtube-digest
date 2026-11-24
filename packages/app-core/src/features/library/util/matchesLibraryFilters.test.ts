import { describe, expect, it } from "vitest";
import { DEFAULT_OVERVIEW_STATE, SourceKey, TopicId } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import { NO_LIBRARY_FILTERS, type LibrarySourceId } from "../types/LibraryFilters.js";
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
      verdict: {
        novelty: "original",
        standsOut: { text: "A new idea.", range: null },
        dubious: false,
        dubiousClaims: [],
        reasoning: "x",
        similarTo: [],
      },
    });
    const thin = makeOverviewWithState({ thin: true, verdict: null });

    expect(matchesLibraryFilters(withVerdict, { ...NO_LIBRARY_FILTERS, novelties: ["original"] })).toBe(true);
    expect(matchesLibraryFilters(thin, { ...NO_LIBRARY_FILTERS, novelties: ["original"] })).toBe(false);
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
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FITNESS_TOPIC, status: "read" })).toBe(false);
  });

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
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, novelties: ["original"] })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, dubious: true })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, query: "anything" })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, tags: ["saas"] })).toBe(false);
  });

  it("filters by a tag on the note or one the reader added", () => {
    const tagged = makeOverviewWithState({ tags: ["saas", "pricing"] });
    const userTagged = makeOverviewWithState({ tags: ["energy"] }, { userTags: ["saas"] });
    const other = makeOverviewWithState({ tags: ["energy"] });

    expect(matchesLibraryFilters(tagged, { ...NO_LIBRARY_FILTERS, tags: ["saas"] })).toBe(true);
    expect(matchesLibraryFilters(userTagged, { ...NO_LIBRARY_FILTERS, tags: ["saas"] })).toBe(true);
    expect(matchesLibraryFilters(other, { ...NO_LIBRARY_FILTERS, tags: ["saas"] })).toBe(false);
  });
});

describe("matchesLibraryFilters with a source saved without its overview", () => {
  const saved = (): LibraryEntry => {
    const { overview } = makeOverviewWithState();
    return {
      kind: "capture",
      capture: {
        id: overview.id,
        sourceKey: SourceKey.parse("savedVideo1"),
        url: "https://www.youtube.com/watch?v=savedVideo1",
        keptAt: overview.savedAt,
        keptFrom: "phone",
        captureReason: null,
        title: overview.source.title,
        thumbnailUrl: null,
        fromPlaylist: null,
        addedAt: null,
        playlistIndex: null,
        chosenAt: null,
        stage: "saved",
        source: overview.source,
        savedAt: overview.savedAt,
        notes: null,
      },
      state: { ...DEFAULT_OVERVIEW_STATE, overviewId: overview.id },
    };
  };

  it("shows under the default view and Unread, found by its title", () => {
    const entry = saved();
    const title = entry.kind === "capture" ? entry.capture.source.title : "";
    expect(matchesLibraryFilters(entry, NO_LIBRARY_FILTERS)).toBe(true);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, status: "unread" })).toBe(true);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, query: title.slice(0, 6) })).toBe(true);
  });

  it("is never under a topic, a verdict, a tag, Read or a favourite, since its overview decides those", () => {
    const entry = saved();
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, topicId: FITNESS_TOPIC })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, novelties: ["original"] })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, tags: ["pricing"] })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, status: "read" })).toBe(false);
    expect(matchesLibraryFilters(entry, { ...NO_LIBRARY_FILTERS, favourite: true })).toBe(false);
  });

  it("is all that Show › No overview yet shows", () => {
    expect(matchesLibraryFilters(saved(), { ...NO_LIBRARY_FILTERS, withoutOverview: true })).toBe(true);
    expect(matchesLibraryFilters(makeOverviewWithState(), { ...NO_LIBRARY_FILTERS, withoutOverview: true })).toBe(false);
  });
});

describe("matchesLibraryFilters, the groups with several values", () => {
  const recipeVideo = makeOverviewWithState({ recipe: {} as never });
  const article = makeOverviewWithState({
    source: {
      kind: "web",
      id: SourceKey.parse("article1"),
      url: "https://www.seriouseats.com/best-pizza",
      title: "Pizza",
      siteName: "Serious Eats",
      author: null,
      publishedAt: null,
      language: null,
      imageUrl: null,
      wordCount: 900,
    },
  } as never);

  it("matches a recipe video under Video and under Recipe", () => {
    expect(matchesLibraryFilters(recipeVideo, { ...NO_LIBRARY_FILTERS, kinds: ["video"] })).toBe(true);
    expect(matchesLibraryFilters(recipeVideo, { ...NO_LIBRARY_FILTERS, kinds: ["recipe"] })).toBe(true);
    expect(matchesLibraryFilters(recipeVideo, { ...NO_LIBRARY_FILTERS, kinds: ["article"] })).toBe(false);
  });

  it("matches any of a group's values", () => {
    expect(matchesLibraryFilters(article, { ...NO_LIBRARY_FILTERS, kinds: ["video", "article"] })).toBe(true);
    const tagged = makeOverviewWithState({ tags: ["pricing"] });
    expect(matchesLibraryFilters(tagged, { ...NO_LIBRARY_FILTERS, tags: ["saas", "pricing"] })).toBe(true);
  });

  it("filters by source, a website by its domain", () => {
    expect(matchesLibraryFilters(article, { ...NO_LIBRARY_FILTERS, sources: ["site:seriouseats.com" as LibrarySourceId] })).toBe(true);
    expect(matchesLibraryFilters(article, { ...NO_LIBRARY_FILTERS, sources: ["youtube" as LibrarySourceId] })).toBe(false);
    expect(matchesLibraryFilters(recipeVideo, { ...NO_LIBRARY_FILTERS, sources: ["youtube" as LibrarySourceId] })).toBe(true);
  });

  it("matches No topic only for an overview in no topic", () => {
    expect(matchesLibraryFilters(makeOverviewWithState(), { ...NO_LIBRARY_FILTERS, topicId: "none" })).toBe(true);
    expect(matchesLibraryFilters(makeOverviewWithState({ topicIds: [FITNESS_TOPIC] }), { ...NO_LIBRARY_FILTERS, topicId: "none" })).toBe(
      false,
    );
  });
});

describe("matchesLibraryFilters by when it was saved", () => {
  const NOW = new Date(2026, 10, 24, 0, 30);
  const savedAt = (date: Date) => makeOverviewWithState({ savedAt: date.toISOString() });

  it("counts Today from local midnight", () => {
    expect(matchesLibraryFilters(savedAt(new Date(2026, 10, 24, 0, 1)), { ...NO_LIBRARY_FILTERS, added: "today" }, NOW)).toBe(true);
    expect(matchesLibraryFilters(savedAt(new Date(2026, 10, 23, 23, 59)), { ...NO_LIBRARY_FILTERS, added: "today" }, NOW)).toBe(false);
  });

  it("counts months back on the calendar", () => {
    expect(matchesLibraryFilters(savedAt(new Date(2026, 7, 24, 1, 0)), { ...NO_LIBRARY_FILTERS, added: "3m" }, NOW)).toBe(true);
    expect(matchesLibraryFilters(savedAt(new Date(2026, 7, 23, 23, 0)), { ...NO_LIBRARY_FILTERS, added: "3m" }, NOW)).toBe(false);
  });

  it("keeps an unreadable record with no date only under Any time", () => {
    const undated = makeUnreadableEntry({ salvaged: null });
    expect(matchesLibraryFilters(undated, NO_LIBRARY_FILTERS, NOW)).toBe(true);
    expect(matchesLibraryFilters(undated, { ...NO_LIBRARY_FILTERS, added: "6m" }, NOW)).toBe(false);
  });
});
