import { describe, expect, it } from "vitest";
import { libraryViewSummary } from "./libraryViewSummary.js";

describe("libraryViewSummary", () => {
  it("says every overview is showing when no filter is on, with the order", () => {
    expect(libraryViewSummary([], "newest")).toBe("Showing: All overviews · Newest saved first");
  });

  it("names each filter that is on, in text, with the order", () => {
    const applied = [
      { key: "status", label: "Unread", clear: { status: "all" as const } },
      { key: "favourite", label: "Favourites", clear: { favourite: false } },
    ];
    expect(libraryViewSummary(applied, "title")).toBe("Showing: Unread, Favourites · Title A–Z");
  });
});
