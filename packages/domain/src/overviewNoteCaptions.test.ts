import test from "node:test";
import assert from "node:assert/strict";
import { NOVELTY_BASIS } from "./noveltyLabel.js";
import { overviewNoteCaptions } from "./overviewNoteCaptions.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

test("captions the verdict with what it was judged against", () => {
  const overview = makeOverview({
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "Standard advice.", similarTo: [] },
  });

  assert.deepEqual(overviewNoteCaptions(overview), { Verdict: NOVELTY_BASIS });
});

test("captions nothing when there is no verdict", () => {
  assert.deepEqual(overviewNoteCaptions(makeOverview()), {});
});
