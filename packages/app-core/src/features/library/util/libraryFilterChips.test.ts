import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { libraryFilterChips } from "./libraryFilterChips.js";

const BUSINESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const TOPICS: Topic[] = [{ id: BUSINESS, name: "Business", description: null, createdAt: "2026-09-01" }];
const DEFAULTS = DEFAULT_LIBRARY_VIEW.filters;

describe("libraryFilterChips", () => {
  it("has no chips for the view the library opens on, Unread only included, nor for a search", () => {
    expect(libraryFilterChips({ ...DEFAULTS, query: "grid" }, TOPICS)).toEqual([]);
  });

  it("orders the chips tag, topic, verdict, show, and each clears only its own filter back to the default", () => {
    const chips = libraryFilterChips(
      { ...DEFAULTS, tag: "founder-interview", topicId: BUSINESS, novelty: "fresh_angle", favourite: true, status: "all" },
      TOPICS,
    );

    expect(chips.map(({ label }) => label)).toEqual(["#founder-interview", "Business", "Fresh angle", "Favourites", "Read and unread"]);
    expect(chips.map(({ clear }) => clear)).toEqual([
      { tag: null },
      { topicId: "all" },
      { novelty: "all" },
      { favourite: false },
      { status: "unread" },
    ]);
  });
});
