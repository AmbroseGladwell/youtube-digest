import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { sharePreview } from "./sharePreview.js";
import { shareSnapshot } from "./shareSnapshot.js";

const noteOf = (overview = makeOverview()) =>
  shareSnapshot({ overview, transcript: null, narration: null }).note;

test("the preview leads with the lengths and then the premise", () => {
  const overview = makeOverview({
    video: { ...makeOverview().video, title: "The Quiet Return of Nuclear Baseload", durationMs: 842_000 },
    inOneLine: "Nuclear is back on the plans because firm capacity became expensive.",
  });

  const preview = sharePreview(noteOf(overview));

  assert.equal(preview.title, "The Quiet Return of Nuclear Baseload");
  assert.equal(
    preview.description,
    "1 min read · 1 min listen · 14:02 video. Nuclear is back on the plans because firm capacity became expensive.",
  );
});

test("the verdict is never in the preview, however blunt it is", () => {
  const preview = sharePreview(
    noteOf(
      makeOverview({
        verdict: { novelty: "common_knowledge", standsOut: null, dubious: true, dubiousClaims: null, reasoning: "Every claim here is secondhand.", similarTo: [] },
      }),
    ),
  );

  assert.equal(preview.description.includes("Every claim here is secondhand."), false);
  assert.equal(preview.description.includes("Common knowledge"), false);
});
