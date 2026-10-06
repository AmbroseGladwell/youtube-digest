import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { MAX_SPOKEN_SCRIPT_CHARACTERS, SpokenScript, spokenLines, spokenScript } from "./SpokenScript.js";

test("speaks every note line in order, headings included, so a timing's index is a line's", () => {
  const overview = makeOverview({
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "Standard advice.", similarTo: [] },
    howToApply: { items: ["Do the thing."] },
  });

  const script = spokenScript(overview);

  assert.equal(script.length, overviewNoteLines(overview).length + 1);
  assert.equal(script[0], "Example, from Example Channel.");
  assert.equal(script[1], "The premise");
});

test("opens with the video's title, channel and month of publication, tidied for speech", () => {
  const overview = makeOverview();
  const script = spokenScript({
    ...overview,
    video: { ...overview.video, title: "Arms (Guaranteed!)", publishedAt: "2024-05-02T10:00:00Z" },
  });

  assert.equal(script[0], "Arms, from Example Channel, published in May 2024.");
});

test("leaves the opening out when the video names nothing to open with", () => {
  const overview = makeOverview();
  const script = spokenScript({ ...overview, video: { ...overview.video, title: "", channel: "" } });

  assert.equal(script.length, overviewNoteLines(overview).length);
});

test("passes over a line shown but not spoken with an empty entry rather than dropping it", () => {
  const script = spokenLines([
    { section: "Verdict", heading: false, bullet: false, text: "Shown only.", spoken: "" },
    { section: "Verdict", heading: false, bullet: false, text: "Standard advice." },
  ]);

  assert.deepEqual(script, ["", "Standard advice."]);
  assert.equal(SpokenScript.safeParse(script).success, true);
});

test("speaks the Verdict heading without the novelty set beside it", () => {
  const overview = makeOverview({
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "Standard advice.", similarTo: [] },
  });

  const script = spokenScript(overview);

  assert.ok(script.includes("The verdict"));
  assert.ok(!script.some((line) => line.includes("Common knowledge")));
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
