import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { fittingChipCount, libraryFilterChips } from "./libraryFilterChips.js";

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

    expect(chips.map(({ label }) => label)).toEqual([
      "#founder-interview",
      "Business",
      "Fresh angle",
      "Favourites",
      "Read and unread",
    ]);
    expect(chips.map(({ clear }) => clear)).toEqual([
      { tag: null },
      { topicId: "all" },
      { novelty: "all" },
      { favourite: false },
      { status: "unread" },
    ]);
  });
});

describe("fittingChipCount", () => {
  it("keeps every chip that fits, with no +N needed", () => {
    expect(fittingChipCount([185, 114], 358, 44, 8)).toBe(2);
  });

  it("leaves room for the +N chip, and never cuts a chip short", () => {
    expect(fittingChipCount([185, 114, 118], 360, 44, 8)).toBe(2);
    expect(fittingChipCount([185, 114, 118], 328, 44, 8)).toBe(1);
  });

  it("can fit none when even the first chip and +N do not", () => {
    expect(fittingChipCount([300, 114], 200, 44, 8)).toBe(0);
  });
});
