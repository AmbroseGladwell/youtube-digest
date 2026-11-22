import { describe, expect, it } from "vitest";
import { citedPlaceFromLocation } from "./citedPlaceFromLocation.js";

describe("citedPlaceFromLocation", () => {
  it("reads the cited item a link carried, and nothing from any other state", () => {
    expect(citedPlaceFromLocation({ citedPlace: { part: "keyPoint", index: 5, textHash: "abc" } })).toEqual({
      part: "keyPoint",
      index: 5,
      textHash: "abc",
    });
    expect(citedPlaceFromLocation(null)).toBeNull();
    expect(citedPlaceFromLocation({ wasJustGenerated: true })).toBeNull();
    expect(citedPlaceFromLocation({ citedPlace: { part: "nonsense", index: 1, textHash: "x" } })).toBeNull();
  });
});
