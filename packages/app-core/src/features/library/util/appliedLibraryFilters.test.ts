import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import { NO_LIBRARY_FILTERS, type LibrarySourceId } from "../types/LibraryFilters.js";
import { appliedLibraryFilters } from "./appliedLibraryFilters.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const SERIOUS_EATS = "site:seriouseats.com" as LibrarySourceId;
const TOPICS: Topic[] = [{ id: FITNESS, name: "fitness", description: null, createdAt: "2026-09-01" }];

describe("appliedLibraryFilters", () => {
  it("lists nothing when no filter is set", () => {
    expect(appliedLibraryFilters(NO_LIBRARY_FILTERS, TOPICS)).toEqual([]);
  });

  it("names the topic rather than its id, and each chip clears only its own filter", () => {
    const applied = appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, topicId: FITNESS }, TOPICS);
    expect(applied[0]?.label).toBe("fitness");
    expect(applied[0]?.clear).toEqual({ topicId: "all" });
  });

  it("still shows a chip for a topic that has since been deleted, so the filter stays clearable", () => {
    const applied = appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, topicId: FITNESS }, []);
    expect(applied[0]?.label).toBe("Topic");
  });

  it("ignores a whitespace-only query", () => {
    expect(appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, query: "   " }, TOPICS)).toEqual([]);
  });

  it("lists every active filter, one chip per chosen value", () => {
    const applied = appliedLibraryFilters(
      {
        kinds: ["article"],
        sources: [SERIOUS_EATS],
        added: "7d",
        topicId: FITNESS,
        novelties: ["original"],
        status: "unread",
        favourite: true,
        withoutOverview: false,
        dubious: true,
        tags: ["saas", "gift-ideas"],
        query: "gdp",
      },
      TOPICS,
    );
    expect(applied.map((chip) => chip.key)).toEqual([
      "kind:article",
      `source:${SERIOUS_EATS}`,
      "added",
      "topic",
      "verdict:original",
      "status",
      "favourite",
      "dubious",
      "tag:saas",
      "tag:gift-ideas",
      "query",
    ]);
  });

  it("takes off only its own value from a group with several", () => {
    const applied = appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, kinds: ["video", "recipe"], tags: ["a", "b"] }, TOPICS);
    expect(applied.find((chip) => chip.key === "kind:video")?.clear).toEqual({ kinds: ["recipe"] });
    expect(applied.find((chip) => chip.key === "tag:b")?.clear).toEqual({ tags: ["a"] });
  });

  it("names a source from the library, and a source no longer in it by its domain", () => {
    const known = [{ id: SERIOUS_EATS, name: "Serious Eats", domain: "seriouseats.com", platform: "website" as const }];
    const gone = "site:example.org" as LibrarySourceId;
    const applied = appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, sources: [SERIOUS_EATS, gone] }, TOPICS, known);
    expect(applied.map((chip) => chip.label)).toEqual(["Serious Eats", "example.org"]);
  });

  it("names No topic", () => {
    expect(appliedLibraryFilters({ ...NO_LIBRARY_FILTERS, topicId: "none" }, TOPICS)[0]?.label).toBe("No topic");
  });
});
