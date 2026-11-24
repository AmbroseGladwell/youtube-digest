import { describe, expect, it } from "vitest";
import { LIBRARY_SORT_PRESET } from "../types/LibrarySort.js";
import { libraryViewSummary } from "./libraryViewSummary.js";

describe("libraryViewSummary", () => {
  it("says every overview is showing when no filter is on, with the order", () => {
    expect(libraryViewSummary([], LIBRARY_SORT_PRESET.newest)).toBe("Showing: All overviews · Newest saved first");
  });

  it("names each filter that is on, in text, with the order", () => {
    const applied = [
      { key: "status", label: "Unread", clear: { status: "all" as const } },
      { key: "favourite", label: "Favourite", clear: { favourite: false } },
    ];
    expect(libraryViewSummary(applied, LIBRARY_SORT_PRESET.title)).toBe("Showing: Unread, Favourite · Title A–Z");
  });

  it("names an order the pill doesn't offer by its field, direction and grouping", () => {
    expect(libraryViewSummary([], { field: "published", direction: "asc", group: "month" })).toBe(
      "Showing: All overviews · Published, oldest first, by month",
    );
  });
});
