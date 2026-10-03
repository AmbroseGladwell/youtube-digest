import { describe, expect, it } from "vitest";
import { libraryCountLine } from "./libraryCountLine.js";

describe("libraryCountLine", () => {
  it("counts the overviews and the unread ones", () => {
    expect(libraryCountLine({ total: 3, unread: 1 }, { savedHere: null, phone: false })).toBe("3 overviews · 1 unread");
    expect(libraryCountLine({ total: 1, unread: 1 }, { savedHere: null, phone: false })).toBe("1 overview · 1 unread");
  });

  it("says where they are kept once this device has signed out (47a)", () => {
    expect(libraryCountLine({ total: 3, unread: 3 }, { savedHere: "in this browser", phone: false })).toBe(
      "3 overviews in this browser · 3 unread",
    );
  });

  it("drops the noun on a phone, where the line is short", () => {
    expect(libraryCountLine({ total: 3, unread: 3 }, { savedHere: "in this browser", phone: true })).toBe(
      "3 in this browser · 3 unread",
    );
  });
});
