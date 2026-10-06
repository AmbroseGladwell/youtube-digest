import { describe, expect, it } from "vitest";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { relatedByTag } from "./relatedByTag.js";

const titled = (title: string, tags: string[], savedAt: string, userTags: string[] = []) =>
  makeOverviewWithState({ video: { ...makeOverviewWithState().overview.video, title }, tags, savedAt }, { userTags });

const titles = (related: ReturnType<typeof relatedByTag>) => related.map(({ overview }) => overview.video.title);

describe("relatedByTag", () => {
  const current = titled("This one", ["saas", "pricing", "founder"], "2026-10-01T00:00:00.000Z");

  it("puts the overviews sharing most tags first, then the newest among equals, and leaves out this one", () => {
    const library = [
      current,
      titled("One shared, older", ["saas"], "2026-09-01T00:00:00.000Z"),
      titled("Two shared", ["saas", "pricing"], "2026-08-01T00:00:00.000Z"),
      titled("One shared, newer", ["founder"], "2026-09-20T00:00:00.000Z"),
      titled("Nothing shared", ["energy"], "2026-10-02T00:00:00.000Z"),
    ];

    expect(titles(relatedByTag(current, library))).toEqual(["Two shared", "One shared, newer", "One shared, older"]);
  });

  it("matches a tag the reader added as well as the note's own", () => {
    const library = [current, titled("Added by the reader", ["energy"], "2026-09-01T00:00:00.000Z", ["pricing"])];

    expect(titles(relatedByTag(current, library))).toEqual(["Added by the reader"]);
  });

  it("stops at the limit", () => {
    const library = Array.from({ length: 10 }, (_, index) =>
      titled(`Related ${index}`, ["saas"], `2026-09-${String(index + 10)}T00:00:00.000Z`),
    );

    expect(relatedByTag(current, library)).toHaveLength(8);
  });
});
