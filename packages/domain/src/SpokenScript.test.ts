import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { MAX_SPOKEN_SCRIPT_CHARACTERS, SpokenScript, spokenScript } from "./SpokenScript.js";

test("speaks every note line in order, headings included, so a timing's index is a line's", () => {
  const overview = makeOverview({
    verdict: { novelty: "recycled", dubious: false, reasoning: "Standard advice.", similarTo: [] },
    howToApply: { items: ["Do the thing."] },
  });

  const script = spokenScript(overview);

  assert.deepEqual(
    script,
    overviewNoteLines(overview).map((line) => line.text),
  );
  assert.equal(script[0], "Premise");
  assert.ok(script.includes("Recycled."));
});

test("accepts the script a real overview produces", () => {
  assert.equal(SpokenScript.safeParse(spokenScript(makeOverview())).success, true);
});

test("refuses an empty script or a blank line", () => {
  assert.equal(SpokenScript.safeParse([]).success, false);
  assert.equal(SpokenScript.safeParse(["Premise", "   "]).success, false);
});

test("refuses a script longer than the cap, counted across its lines", () => {
  const half = "a".repeat(MAX_SPOKEN_SCRIPT_CHARACTERS / 2);

  assert.equal(SpokenScript.safeParse([half, half]).success, true);
  assert.equal(SpokenScript.safeParse([half, half, "a"]).success, false);
});
