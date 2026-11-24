import { beforeEach, describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import type { LibrarySourceId } from "./types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "./types/LibraryView.js";
import { readLibraryView, writeLibraryView } from "./libraryViewStorage.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const CHOSEN = {
  filters: {
    kinds: ["video" as const, "recipe" as const],
    sources: [],
    added: "30d" as const,
    topicId: FITNESS,
    novelties: ["original" as const, "fresh_angle" as const],
    status: "all" as const,
    favourite: true,
    withoutOverview: false,
    dubious: false,
    tags: [],
    query: "",
  },
  sort: "title" as const,
};

describe("libraryViewStorage", () => {
  beforeEach(() => localStorage.clear());

  it("has nothing saved on a device that never chose", () => {
    expect(readLibraryView(null)).toBeNull();
  });

  it("gives back the view an account left, including every filter turned off", () => {
    writeLibraryView("account-a", CHOSEN);
    writeLibraryView(null, { ...DEFAULT_LIBRARY_VIEW, filters: { ...DEFAULT_LIBRARY_VIEW.filters, status: "all" } });

    expect(readLibraryView("account-a")).toEqual({ view: CHOSEN, dropped: [] });
    expect(readLibraryView(null)?.view.filters.status).toBe("all");
  });

  it("keeps each account's view apart from every other's and from the no-account one", () => {
    writeLibraryView("account-a", CHOSEN);

    expect(readLibraryView("account-b")).toBeNull();
    expect(readLibraryView(null)).toBeNull();
  });

  it("never keeps the search, a tag or a source", () => {
    writeLibraryView(null, {
      ...CHOSEN,
      filters: { ...CHOSEN.filters, query: "batteries", tags: ["gift-ideas"], sources: ["site:seriouseats.com" as LibrarySourceId] },
    });

    expect(readLibraryView(null)?.view.filters).toMatchObject({ query: "", tags: [], sources: [] });
  });

  it("keeps No topic", () => {
    writeLibraryView(null, { ...CHOSEN, filters: { ...CHOSEN.filters, topicId: "none" } });

    expect(readLibraryView(null)?.view.filters.topicId).toBe("none");
  });

  it("reads a view saved before kinds and verdicts were lists, one kind and one verdict as a list of one", () => {
    localStorage.setItem(
      "overview.libraryView.noAccount",
      JSON.stringify({
        version: 1,
        source: "recipe",
        topic: "all",
        novelty: "original",
        status: "unread",
        favourite: true,
        dubious: false,
        sort: "title",
      }),
    );

    expect(readLibraryView(null)).toEqual({
      view: {
        filters: { ...DEFAULT_LIBRARY_VIEW.filters, kinds: ["recipe"], novelties: ["original"], favourite: true },
        sort: "title",
      },
      dropped: [],
    });
  });

  it("reads a version 1 view that never chose a kind or a verdict as any of them", () => {
    localStorage.setItem(
      "overview.libraryView.noAccount",
      JSON.stringify({ version: 1, topic: "all", novelty: "all", status: "all", favourite: false, dubious: false, sort: "newest" }),
    );

    expect(readLibraryView(null)?.view.filters).toMatchObject({ kinds: [], novelties: [], added: "any" });
  });

  it("drops a saved value it no longer knows, keeping the rest and naming what went", () => {
    localStorage.setItem(
      "overview.libraryView.noAccount",
      JSON.stringify({
        version: 1,
        topic: FITNESS,
        novelty: "made-up",
        status: "unread",
        favourite: false,
        withoutOverview: false,
        dubious: false,
        sort: "verdict",
      }),
    );

    expect(readLibraryView(null)).toEqual({
      view: { ...DEFAULT_LIBRARY_VIEW, filters: { ...DEFAULT_LIBRARY_VIEW.filters, topicId: FITNESS } },
      dropped: ["novelties", "sort"],
    });
  });

  it("reads a value from another version, or one that isn't JSON, as nothing saved", () => {
    localStorage.setItem("overview.libraryView.noAccount", JSON.stringify({ version: 3, status: "all" }));
    expect(readLibraryView(null)).toBeNull();

    localStorage.setItem("overview.libraryView.noAccount", "{not json");
    expect(readLibraryView(null)).toBeNull();
  });
});

describe("libraryViewStorage, when the browser refuses storage", () => {
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  } as unknown as Storage;

  it("saves nothing and has nothing saved, without throwing", () => {
    expect(() => writeLibraryView(null, CHOSEN, refusing)).not.toThrow();
    expect(readLibraryView(null, refusing)).toBeNull();
  });
});
