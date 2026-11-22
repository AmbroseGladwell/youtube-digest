import { describe, expect, it } from "vitest";
import { TRANSCRIPT_MOMENT_STATE, transcriptMomentFromLocation } from "./transcriptMomentFromLocation.js";

describe("transcriptMomentFromLocation", () => {
  it("reads the moment a library search sent, beside the library view", () => {
    expect(transcriptMomentFromLocation({ libraryView: "q=x", kept: [], [TRANSCRIPT_MOMENT_STATE]: 65_000 })).toBe(65_000);
  });

  it("has no moment without one, or with anything that isn't a time", () => {
    expect(transcriptMomentFromLocation(null)).toBeNull();
    expect(transcriptMomentFromLocation({ libraryView: "" })).toBeNull();
    expect(transcriptMomentFromLocation({ [TRANSCRIPT_MOMENT_STATE]: "65000" })).toBeNull();
    expect(transcriptMomentFromLocation({ [TRANSCRIPT_MOMENT_STATE]: -1 })).toBeNull();
  });
});
