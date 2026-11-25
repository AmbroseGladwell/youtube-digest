import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import { createAnalytics } from "../../analytics/createAnalytics.js";
import { NO_LIBRARY_FILTERS, type LibrarySourceId } from "../types/LibraryFilters.js";
import { recordLibraryFilterChange } from "./recordLibraryFilterChange.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");

const recording = () => {
  const recorded: Array<[string, unknown]> = [];
  const analytics = createAnalytics({ record: (name, props) => void recorded.push([name, props]), flush: async () => {} });
  return { recorded, filters: analytics.library.filters };
};

describe("recordLibraryFilterChange", () => {
  it("names a topic by its id and a novelty or status by its own value", () => {
    const { recorded, filters } = recording();

    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { topicId: FITNESS }, "panel");
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { novelties: ["common_knowledge"] }, "panel");
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { status: "unread" }, "panel");
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { dubious: true }, "panel");

    expect(recorded).toEqual([
      ["library.filters.topicChosen", { topicId: FITNESS, from: "panel" }],
      ["library.filters.noveltySwitched", { novelty: "common_knowledge", on: true, from: "panel" }],
      ["library.filters.statusChosen", { status: "unread", from: "panel" }],
      ["library.filters.dubiousSwitched", { on: true, from: "panel" }],
    ]);
  });

  it("counts a tag being chosen and cleared without ever naming the tag", () => {
    const { recorded, filters } = recording();

    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { tags: ["saas"] }, "panel");
    recordLibraryFilterChange(filters, { ...NO_LIBRARY_FILTERS, tags: ["saas"] }, { tags: [] }, "filterChip");

    expect(recorded).toEqual([
      ["library.filters.tagChosen", { from: "panel" }],
      ["library.filters.tagCleared", { from: "filterChip" }],
    ]);
  });

  it("counts only what the patch changed, so clearing everything names each filter that was on", () => {
    const { recorded, filters } = recording();
    const before = { ...NO_LIBRARY_FILTERS, topicId: FITNESS, favourite: true, query: "grid" };

    recordLibraryFilterChange(filters, before, NO_LIBRARY_FILTERS, "clearAll");

    expect(recorded).toEqual([
      ["library.filters.topicCleared", { from: "clearAll" }],
      ["library.filters.favouriteSwitched", { on: false, from: "clearAll" }],
    ]);
  });

  it("names a website source only as a website, never its domain, and a platform by name", () => {
    const { recorded, filters } = recording();
    const sources = [
      { id: "site:seriouseats.com" as LibrarySourceId, name: "Serious Eats", domain: "seriouseats.com", platform: "website" as const },
    ];

    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { sources: [sources[0]!.id, "youtube" as LibrarySourceId] }, "panel", sources);

    expect(recorded).toEqual([
      ["library.filters.sourceSwitched", { source: "website", on: true, from: "panel" }],
      ["library.filters.sourceSwitched", { source: "youtube", on: true, from: "panel" }],
    ]);
  });

  it("counts each kind switched on or off, the Added range and No topic", () => {
    const { recorded, filters } = recording();

    recordLibraryFilterChange(
      filters,
      { ...NO_LIBRARY_FILTERS, kinds: ["video"] },
      { kinds: ["recipe"], added: "7d", topicId: "none" },
      "panel",
    );

    expect(recorded).toEqual([
      ["library.filters.kindSwitched", { kind: "recipe", on: true, from: "panel" }],
      ["library.filters.kindSwitched", { kind: "video", on: false, from: "panel" }],
      ["library.filters.addedChosen", { added: "7d", from: "panel" }],
      ["library.filters.noTopicChosen", { from: "panel" }],
    ]);
  });
});
