import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import { NO_LIBRARY_FILTERS, type LibrarySourceId } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import {
  applyLibraryFilterPatch,
  applyLibrarySort,
  applyLibraryView,
  hasLibraryViewParams,
  isSameLibraryView,
  parseLibraryFilters,
  parseLibrarySort,
  parseLibraryView,
} from "./libraryFilterParams.js";

const TOPIC = TopicId.parse("11111111-1111-4111-8111-111111111111");

describe("parseLibraryFilters", () => {
  it("defaults to 'all' filters and an empty query with no params", () => {
    expect(parseLibraryFilters(new URLSearchParams())).toEqual(NO_LIBRARY_FILTERS);
  });

  it("reads valid topic, verdict, status and q params", () => {
    const params = new URLSearchParams({ topic: TOPIC, verdict: "original", status: "read", q: "botox" });
    expect(parseLibraryFilters(params)).toEqual({
      ...NO_LIBRARY_FILTERS,
      topicId: TOPIC,
      novelties: ["original"],
      status: "read",
      query: "botox",
    });
  });

  it("falls back to 'all' for a malformed topic or verdict param, rather than throwing", () => {
    const params = new URLSearchParams({ topic: "not-a-uuid", verdict: "made-up" });
    expect(parseLibraryFilters(params)).toEqual(NO_LIBRARY_FILTERS);
  });

  it("reads only the tags that are tags as the library stores them", () => {
    expect(parseLibraryFilters(new URLSearchParams({ tag: "micro-saas,gift-ideas" })).tags).toEqual(["micro-saas", "gift-ideas"]);
    expect(parseLibraryFilters(new URLSearchParams({ tag: "Micro SaaS,gift-ideas" })).tags).toEqual(["gift-ideas"]);
  });

  it("reads several kinds, sources and verdicts, the Added range and No topic", () => {
    const params = new URLSearchParams({
      kind: "video,recipe,made-up",
      source: "youtube,site:seriouseats.com",
      verdict: "original,fresh_angle",
      added: "3m",
      topic: "none",
    });
    expect(parseLibraryFilters(params)).toMatchObject({
      kinds: ["video", "recipe"],
      sources: ["youtube", "site:seriouseats.com"],
      novelties: ["original", "fresh_angle"],
      added: "3m",
      topicId: "none",
    });
  });

  it("reads an old ?source=video link as the kind, so bookmarks keep working", () => {
    expect(parseLibraryFilters(new URLSearchParams({ source: "video" }))).toMatchObject({ kinds: ["video"], sources: [] });
  });

  it("falls back to any time for an Added value it doesn't know", () => {
    expect(parseLibraryFilters(new URLSearchParams({ added: "1y" })).added).toBe("any");
  });

  it("reads the favourite and dubious flags only from their exact param value", () => {
    expect(parseLibraryFilters(new URLSearchParams({ fav: "1", dubious: "1" }))).toMatchObject({
      favourite: true,
      dubious: true,
    });
    expect(parseLibraryFilters(new URLSearchParams({ fav: "true", dubious: "yes" }))).toMatchObject({
      favourite: false,
      dubious: false,
    });
  });
});

describe("applyLibraryFilterPatch", () => {
  it("drops the flag params when patched off, rather than writing a falsy value", () => {
    const withFlags = new URLSearchParams({ fav: "1", dubious: "1" });
    const next = applyLibraryFilterPatch(withFlags, { favourite: false, dubious: false });
    expect(next.has("fav")).toBe(false);
    expect(next.has("dubious")).toBe(false);
  });

  it("sets a param for a real value", () => {
    const next = applyLibraryFilterPatch(new URLSearchParams(), { novelties: ["common_knowledge", "original"] });
    expect(next.get("verdict")).toBe("common_knowledge,original");
  });

  it("removes the param when a group is patched back to nothing chosen", () => {
    const withFilter = new URLSearchParams({ verdict: "common_knowledge", added: "7d" });
    const next = applyLibraryFilterPatch(withFilter, { novelties: [], added: "any" });
    expect(next.toString()).toBe("");
  });

  it("moves an old ?source=video into kind when either kinds or sources change", () => {
    const next = applyLibraryFilterPatch(new URLSearchParams({ source: "video" }), { sources: ["youtube" as LibrarySourceId] });
    expect(next.get("kind")).toBe("video");
    expect(next.get("source")).toBe("youtube");
    expect(parseLibraryFilters(next)).toMatchObject({ kinds: ["video"], sources: ["youtube"] });
  });

  it("removes q when patched to an empty string", () => {
    const withQuery = new URLSearchParams({ q: "botox" });
    const next = applyLibraryFilterPatch(withQuery, { query: "" });
    expect(next.has("q")).toBe(false);
  });

  it("leaves untouched params alone", () => {
    const params = new URLSearchParams({ status: "read" });
    const next = applyLibraryFilterPatch(params, { novelties: ["original"] });
    expect(next.get("status")).toBe("read");
    expect(next.get("verdict")).toBe("original");
  });

  it("keeps the sort when every filter is cleared, since the order is not a filter", () => {
    const params = new URLSearchParams({ sort: "title", verdict: "original" });
    const next = applyLibraryFilterPatch(params, NO_LIBRARY_FILTERS);
    expect(next.get("sort")).toBe("title");
  });
});

describe("parseLibrarySort", () => {
  it("defaults to newest first with no param, and for a value it does not know", () => {
    expect(parseLibrarySort(new URLSearchParams())).toBe("newest");
    expect(parseLibrarySort(new URLSearchParams({ sort: "made-up" }))).toBe("newest");
  });

  it("reads a known sort", () => {
    expect(parseLibrarySort(new URLSearchParams({ sort: "oldest" }))).toBe("oldest");
    expect(parseLibrarySort(new URLSearchParams({ sort: "title" }))).toBe("title");
  });
});

describe("applyLibrarySort", () => {
  it("writes a non-default sort and leaves the filters alone", () => {
    const next = applyLibrarySort(new URLSearchParams({ verdict: "original" }), "title");
    expect(next.get("sort")).toBe("title");
    expect(next.get("verdict")).toBe("original");
  });

  it("drops the param for the default order, rather than writing it", () => {
    const next = applyLibrarySort(new URLSearchParams({ sort: "oldest" }), "newest");
    expect(next.has("sort")).toBe(false);
  });
});

describe("hasLibraryViewParams", () => {
  it("is true for a link that names any filter or the order, and false for one that names none", () => {
    expect(hasLibraryViewParams(new URLSearchParams())).toBe(false);
    expect(hasLibraryViewParams(new URLSearchParams({ other: "1" }))).toBe(false);
    expect(hasLibraryViewParams(new URLSearchParams({ sort: "title" }))).toBe(true);
    expect(hasLibraryViewParams(new URLSearchParams({ status: "unread" }))).toBe(true);
  });
});

describe("applyLibraryView", () => {
  it("writes a whole view, replacing every filter and the order, and reads back the same", () => {
    const current = new URLSearchParams({ verdict: "original", sort: "title", other: "kept" });
    const next = applyLibraryView(current, DEFAULT_LIBRARY_VIEW);

    expect(next.toString()).toBe("other=kept&status=unread");
    expect(parseLibraryView(next)).toEqual(DEFAULT_LIBRARY_VIEW);
  });
});

describe("isSameLibraryView", () => {
  it("compares every filter and the order", () => {
    expect(isSameLibraryView(DEFAULT_LIBRARY_VIEW, { ...DEFAULT_LIBRARY_VIEW })).toBe(true);
    expect(isSameLibraryView(DEFAULT_LIBRARY_VIEW, { ...DEFAULT_LIBRARY_VIEW, sort: "oldest" })).toBe(false);
    expect(
      isSameLibraryView(DEFAULT_LIBRARY_VIEW, {
        ...DEFAULT_LIBRARY_VIEW,
        filters: { ...DEFAULT_LIBRARY_VIEW.filters, query: "grid" },
      }),
    ).toBe(false);
  });
});
