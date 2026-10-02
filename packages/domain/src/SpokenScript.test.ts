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

  assert.equal(script.length, overviewNoteLines(overview).length);
  assert.equal(script[0], "The premise");
});

test("passes over the verdict label with an empty entry rather than dropping its line", () => {
  const overview = makeOverview({
    verdict: { novelty: "recycled", dubious: false, reasoning: "Standard advice.", similarTo: [] },
  });

  const script = spokenScript(overview);
  const labelIndex = overviewNoteLines(overview).findIndex((line) => line.text === "Recycled.");

  assert.equal(script[labelIndex], "");
  assert.equal(script[labelIndex + 1], "Standard advice.");
  assert.equal(SpokenScript.safeParse(script).success, true);
});

test("tidies the spoken text for speech", () => {
  const script = spokenScript(makeOverview({ coreClaim: "Save 20% (roughly) vs spending." }));

  assert.ok(script.includes("Save 20 percent versus spending."));
});

test("accepts the script a real overview produces", () => {
  assert.equal(SpokenScript.safeParse(spokenScript(makeOverview())).success, true);
});

test("refuses an empty script or one with nothing to say", () => {
  assert.equal(SpokenScript.safeParse([]).success, false);
  assert.equal(SpokenScript.safeParse(["   ", ""]).success, false);
  assert.equal(SpokenScript.safeParse(["Premise", ""]).success, true);
});

test("refuses a script longer than the cap, counted across its lines", () => {
  const half = "a".repeat(MAX_SPOKEN_SCRIPT_CHARACTERS / 2);

  assert.equal(SpokenScript.safeParse([half, half]).success, true);
  assert.equal(SpokenScript.safeParse([half, half, "a"]).success, false);
});
