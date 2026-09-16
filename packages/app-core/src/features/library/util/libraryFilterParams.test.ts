import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/types";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { applyLibraryFilterPatch, parseLibraryFilters } from "./libraryFilterParams.js";

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
      query: "botox",
    });
  });

  it("falls back to 'all' for a malformed topic or verdict param, rather than throwing", () => {
    const params = new URLSearchParams({ topic: "not-a-uuid", verdict: "made-up" });
    expect(parseLibraryFilters(params)).toEqual(DEFAULT_LIBRARY_FILTERS);
  });
});

describe("applyLibraryFilterPatch", () => {
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
});
