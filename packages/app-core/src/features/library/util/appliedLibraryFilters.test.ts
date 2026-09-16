import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/types";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { appliedLibraryFilters } from "./appliedLibraryFilters.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const TOPICS: Topic[] = [{ id: FITNESS, name: "fitness", description: null, createdAt: "2026-09-01" }];

describe("appliedLibraryFilters", () => {
  it("lists nothing when no filter is set", () => {
    expect(appliedLibraryFilters(DEFAULT_LIBRARY_FILTERS, TOPICS)).toEqual([]);
  });

  it("names the topic rather than its id, and each chip clears only its own filter", () => {
    const applied = appliedLibraryFilters({ ...DEFAULT_LIBRARY_FILTERS, topicId: FITNESS }, TOPICS);
    expect(applied[0]?.label).toBe("fitness");
    expect(applied[0]?.clear).toEqual({ topicId: "all" });
  });

  it("still shows a chip for a topic that has since been deleted, so the filter stays clearable", () => {
    const applied = appliedLibraryFilters({ ...DEFAULT_LIBRARY_FILTERS, topicId: FITNESS }, []);
    expect(applied[0]?.label).toBe("Topic");
  });

  it("ignores a whitespace-only query", () => {
    expect(appliedLibraryFilters({ ...DEFAULT_LIBRARY_FILTERS, query: "   " }, TOPICS)).toEqual([]);
  });

  it("lists every active filter", () => {
    const applied = appliedLibraryFilters(
      { topicId: FITNESS, novelty: "novel", status: "unread", favourite: true, dubious: true, query: "gdp" },
      TOPICS,
    );
    expect(applied.map((chip) => chip.key)).toEqual([
      "topic",
      "verdict",
      "status",
      "favourite",
      "dubious",
      "query",
    ]);
  });
});
