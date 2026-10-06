import { describe, expect, it } from "vitest";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { filtersChangedFromDefault } from "./filtersChangedFromDefault.js";

describe("filtersChangedFromDefault", () => {
  const defaults = DEFAULT_LIBRARY_VIEW.filters;

  it("counts nothing for the view the library opens on, Unread included", () => {
    expect(filtersChangedFromDefault(defaults)).toBe(0);
  });

  it("counts each filter that differs, turning Unread off among them, but never the search", () => {
    expect(filtersChangedFromDefault({ ...defaults, status: "all", tag: "saas", query: "grid" })).toBe(2);
  });
});
