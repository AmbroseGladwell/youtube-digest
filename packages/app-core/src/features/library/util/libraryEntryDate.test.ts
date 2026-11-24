import { describe, expect, it } from "vitest";
import { libraryActivityOf } from "./libraryEntryDate.js";

describe("libraryActivityOf", () => {
  it("takes the latest of a project the reader or an assistant added it to and a chat about the overview", () => {
    const activity = libraryActivityOf(
      [
        { overviewId: "a", addedAt: "2026-10-01T00:00:00.000Z", addedBy: { by: "reader" } },
        { overviewId: "a", addedAt: "2026-10-03T00:00:00.000Z", addedBy: { by: "assistant" } },
      ],
      [{ overviewId: "a", messages: [{ at: "2026-10-02T00:00:00.000Z" }] }],
    );

    expect(activity.get("a")).toBe(Date.parse("2026-10-03T00:00:00.000Z"));
  });

  it("never counts filing as the overview was made, nor a library or project chat that cited it", () => {
    const activity = libraryActivityOf(
      [{ overviewId: "a", addedAt: "2026-10-01T00:00:00.000Z", addedBy: { by: "filing" } }],
      [{ messages: [{ at: "2026-10-02T00:00:00.000Z" }] }],
    );

    expect(activity.has("a")).toBe(false);
  });

  it("dates a chat by its last message", () => {
    const activity = libraryActivityOf(
      [],
      [{ overviewId: "a", messages: [{ at: "2026-10-01T00:00:00.000Z" }, { at: "2026-10-09T00:00:00.000Z" }] }],
    );

    expect(activity.get("a")).toBe(Date.parse("2026-10-09T00:00:00.000Z"));
  });
});
