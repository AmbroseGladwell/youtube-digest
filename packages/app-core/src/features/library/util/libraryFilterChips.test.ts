import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import type { LibrarySourceId } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { libraryFilterChips } from "./libraryFilterChips.js";

const BUSINESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const TOPICS: Topic[] = [{ id: BUSINESS, name: "Business", description: null, createdAt: "2026-09-01" }];
const DEFAULTS = DEFAULT_LIBRARY_VIEW.filters;

describe("libraryFilterChips", () => {
  it("has no chips for the view the library opens on, Unread included, nor for a search", () => {
    expect(libraryFilterChips({ ...DEFAULTS, query: "grid" }, TOPICS)).toEqual([]);
  });

  it("orders the chips as the menu's groups, and each clears only its own filter back to the default", () => {
    const chips = libraryFilterChips(
      { ...DEFAULTS, tags: ["founder-interview"], topicId: BUSINESS, novelties: ["fresh_angle"], favourite: true, status: "all" },
      TOPICS,
    );

    expect(chips.map(({ label }) => label)).toEqual(["Read and unread", "Favourite", "Business", "#founder-interview", "Fresh angle"]);
    expect(chips.map(({ clear }) => clear)).toEqual([
      { status: "unread" },
      { favourite: false },
      { topicId: "all" },
      { tags: [] },
      { novelties: [] },
    ]);
  });

  it("gives each kind, source and verdict its own chip that takes off only that one", () => {
    const sources = [{ id: "youtube" as LibrarySourceId, name: "YouTube", domain: "youtube.com", platform: "youtube" as const }];
    const chips = libraryFilterChips(
      { ...DEFAULTS, kinds: ["video", "recipe"], sources: ["youtube" as LibrarySourceId], added: "today" },
      TOPICS,
      DEFAULTS,
      sources,
    );

    expect(chips.map(({ label }) => label)).toEqual(["Today", "Video", "Recipe", "YouTube"]);
    expect(chips[1]?.clear).toEqual({ kinds: ["recipe"] });
    expect(chips[3]?.clear).toEqual({ sources: [] });
  });
});
