import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import {
  applyLibraryFilterPatch,
  applyLibrarySort,
  parseLibraryFilters,
  parseLibrarySort,
} from "./libraryFilterParams.js";

const TOPIC = TopicId.parse("11111111-1111-4111-8111-111111111111");

describe("parseLibraryFilters", () => {
  it("defaults to 'all' filters and an empty query with no params", () => {
    expect(parseLibraryFilters(new URLSearchParams())).toEqual(DEFAULT_LIBRARY_FILTERS);
  });

  it("reads valid topic, verdict, status and q params", () => {
    const params = new URLSearchParams({ topic: TOPIC, verdict: "novel", status: "read", q: "botox" });
    expect(parseLibraryFilters(params)).toEqual({
      topicId: TOPIC,
      novelty: "novel",
      status: "read",
      favourite: false,
      dubious: false,
      query: "botox",
    });
  });

  it("falls back to 'all' for a malformed topic or verdict param, rather than throwing", () => {
    const params = new URLSearchParams({ topic: "not-a-uuid", verdict: "made-up" });
    expect(parseLibraryFilters(params)).toEqual(DEFAULT_LIBRARY_FILTERS);
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
    const next = applyLibraryFilterPatch(new URLSearchParams(), { novelty: "recycled" });
    expect(next.get("verdict")).toBe("recycled");
  });

  it("removes the param when patched back to 'all', instead of writing the literal string", () => {
    const withFilter = new URLSearchParams({ verdict: "recycled" });
    const next = applyLibraryFilterPatch(withFilter, { novelty: "all" });
    expect(next.has("verdict")).toBe(false);
  });

  it("removes q when patched to an empty string", () => {
    const withQuery = new URLSearchParams({ q: "botox" });
    const next = applyLibraryFilterPatch(withQuery, { query: "" });
    expect(next.has("q")).toBe(false);
  });

  it("leaves untouched params alone", () => {
    const params = new URLSearchParams({ status: "read" });
    const next = applyLibraryFilterPatch(params, { novelty: "novel" });
    expect(next.get("status")).toBe("read");
    expect(next.get("verdict")).toBe("novel");
  });

  it("keeps the sort when every filter is cleared, since the order is not a filter", () => {
    const params = new URLSearchParams({ sort: "title", verdict: "novel" });
    const next = applyLibraryFilterPatch(params, DEFAULT_LIBRARY_FILTERS);
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
    const next = applyLibrarySort(new URLSearchParams({ verdict: "novel" }), "title");
    expect(next.get("sort")).toBe("title");
    expect(next.get("verdict")).toBe("novel");
  });

  it("drops the param for the default order, rather than writing it", () => {
    const next = applyLibrarySort(new URLSearchParams({ sort: "oldest" }), "newest");
    expect(next.has("sort")).toBe(false);
  });
});
