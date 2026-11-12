import test from "node:test";
import assert from "node:assert/strict";
import { noteText } from "./judgeStepsCarried.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

test("the judge reads the steps block as part of the note, and never the watch-anyway reason", () => {
  const text = noteText({
    ...makeOverview(),
    sourceSteps: { items: [{ text: "Finish fast; it means it is working.", range: null, dubiousReason: null }] },
    watchAnyway: { answer: "no", reason: "The overview covers every step.", range: null },
  });

  assert.ok(text.includes("## The steps it gives\n- Finish fast; it means it is working."));
  assert.ok(!text.includes("covers every step"));
});
