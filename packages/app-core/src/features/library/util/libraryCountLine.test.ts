import { describe, expect, it } from "vitest";
import { libraryCountLine } from "./libraryCountLine.js";

describe("libraryCountLine", () => {
  it("counts the overviews and the unread ones", () => {
    expect(libraryCountLine({ total: 3, unread: 1 })).toBe("3 overviews · 1 unread");
    expect(libraryCountLine({ total: 1, unread: 1 })).toBe("1 overview · 1 unread");
  });
});
