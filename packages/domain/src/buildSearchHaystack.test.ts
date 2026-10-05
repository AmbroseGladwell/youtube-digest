import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "./Brands.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
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
      keyPoints: [{ text: "Jaw strain warning", range: null }],
      tags: ["face-yoga"],
    });

    const haystack = buildSearchHaystack(overview);

    assert.ok(haystack.includes("the platysma trick"));
    assert.ok(haystack.includes("soloma"));
    assert.ok(haystack.includes("jaw strain warning"));
    assert.ok(haystack.includes("face-yoga"));
  });

  it("includes verdict reasoning and selling detail when present", () => {
    const overview = makeOverview({
      verdict: { novelty: "common_knowledge", standsOut: null, dubious: true, reasoning: "Contradicts settled anatomy.", similarTo: [] },
      selling: { type: "own_paid_product", detail: "Pitches a Patreon course.", compromisesContent: true },
    });

    const haystack = buildSearchHaystack(overview);

    assert.ok(haystack.includes("contradicts settled anatomy"));
    assert.ok(haystack.includes("pitches a patreon course"));
  });

  it("degrades cleanly when verdict and selling are absent", () => {
    const overview = makeOverview({ verdict: null, selling: null, howToApply: null });
    assert.doesNotThrow(() => buildSearchHaystack(overview));
  });
});
