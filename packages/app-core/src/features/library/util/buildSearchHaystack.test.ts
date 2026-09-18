import { VideoId } from "@overview/types";
import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { buildSearchHaystack } from "./buildSearchHaystack.js";

describe("buildSearchHaystack", () => {
  it("includes title, channel, claim, key points and tags, lowercased", () => {
    const overview = makeOverview({
      video: {
        id: VideoId.parse("x"),
        url: "https://www.youtube.com/watch?v=x",
        title: "The Platysma Trick",
        channel: "SOLOMA",
        description: null,
        durationMs: null,
    publishedAt: null,
        thumbnailUrl: null,
      },
      keyPoints: ["Jaw strain warning"],
      tags: ["face-yoga"],
    });

    const haystack = buildSearchHaystack(overview);

    expect(haystack).toContain("the platysma trick");
    expect(haystack).toContain("soloma");
    expect(haystack).toContain("jaw strain warning");
    expect(haystack).toContain("face-yoga");
  });

  it("includes verdict reasoning and selling detail when present", () => {
    const overview = makeOverview({
      verdict: { novelty: "recycled", dubious: true, reasoning: "Contradicts settled anatomy.", similarTo: [] },
      selling: { type: "own_paid_product", detail: "Pitches a Patreon course.", compromisesContent: true },
    });

    const haystack = buildSearchHaystack(overview);

    expect(haystack).toContain("contradicts settled anatomy");
    expect(haystack).toContain("pitches a patreon course");
  });

  it("degrades cleanly when verdict and selling are absent", () => {
    const overview = makeOverview({ verdict: null, selling: null, howToApply: null });
    expect(() => buildSearchHaystack(overview)).not.toThrow();
  });
});
