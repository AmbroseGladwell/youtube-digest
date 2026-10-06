import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import { createAnalytics } from "../../analytics/createAnalytics.js";
import { NO_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
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
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { novelty: "common_knowledge" }, "panel");
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { status: "unread" }, "panel");
    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { dubious: true }, "panel");

    expect(recorded).toEqual([
      ["library.filters.topicChosen", { topicId: FITNESS, from: "panel" }],
      ["library.filters.noveltyChosen", { novelty: "common_knowledge", from: "panel" }],
      ["library.filters.statusChosen", { status: "unread", from: "panel" }],
      ["library.filters.dubiousSwitched", { on: true, from: "panel" }],
    ]);
  });

  it("counts a tag being chosen and cleared without ever naming the tag", () => {
    const { recorded, filters } = recording();

    recordLibraryFilterChange(filters, NO_LIBRARY_FILTERS, { tag: "saas" }, "panel");
    recordLibraryFilterChange(filters, { ...NO_LIBRARY_FILTERS, tag: "saas" }, { tag: null }, "filterChip");

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
});
