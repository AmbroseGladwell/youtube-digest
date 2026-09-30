import { describe, expect, it } from "vitest";
import { ShareToken, shareSnapshot } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { sharedPageIntentNote } from "./sharedPageIntentNote.js";

describe("sharedPageIntentNote", () => {
  it("names the overview that is waiting to be saved", () => {
    const note = sharedPageIntentNote({
      kind: "save",
      token: ShareToken.parse("k7Qm2x9RfTabcdef"),
      title: "The Quiet Return of Nuclear Baseload",
      snapshot: shareSnapshot({ overview: makeOverview(), transcript: null, narration: null }),
    });

    expect(note).toEqual({
      label: "Saving",
      body: "The Quiet Return of Nuclear Baseload, into your library once you’ve confirmed.",
    });
  });

  it("says what a pasted link will become", () => {
    const note = sharedPageIntentNote({ kind: "generate", videoUrl: "https://www.youtube.com/watch?v=abc" });

    expect(note?.label).toBe("Making an overview");
  });

  // Every other way to this page: nothing is waiting, so nothing is promised.
  it("says nothing when the visitor arrived with nothing in hand", () => {
    expect(sharedPageIntentNote(null)).toBeNull();
  });
});
