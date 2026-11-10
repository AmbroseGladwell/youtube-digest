import test from "node:test";
import assert from "node:assert/strict";
import { EVIDENCE_MOST_WORDS } from "@overview/domain";
import { liftQuotation, wholePassage } from "./liftQuotation.js";

const segment = (text: string, at: number) => ({ text, startMs: at * 1000, endMs: at * 1000 + 1000 });

test("a quotation is the segments' own words, joined, timed from the first to the last", () => {
  assert.deepEqual(liftQuotation([segment("You're not going to", 4), segment("out-train a bad diet.", 5)]), {
    text: "You're not going to out-train a bad diet.",
    range: { startMs: 4000, endMs: 6000 },
  });
});

test("the tail of the sentence before and the start of the sentence after are trimmed away", () => {
  assert.equal(
    wholePassage(["like that. So look, here's the uncomfortable truth.", "Saving matters more. Compared with semaglutide or"]),
    "So look, here's the uncomfortable truth. Saving matters more.",
  );
});

test("a caption's annotations and speaker marks are not quoted as speech", () => {
  assert.equal(
    wholePassage([">> Yes, that's where I'm going next.", "[Music] So, 5% is due to testosterone."]),
    "Yes, that's where I'm going next. So, 5% is due to testosterone.",
  );
  assert.equal(wholePassage(["[Music]"]), null);
});

test("unpunctuated captions are quoted as they are, since there is no sentence to find", () => {
  assert.equal(
    wholePassage(["we know that they're using AI but we can't prove it"]),
    "we know that they're using AI but we can't prove it",
  );
});

test("a passage longer than the cap is no quotation, never a cut one", () => {
  assert.equal(
    wholePassage([`${Array(EVIDENCE_MOST_WORDS).fill("word").join(" ")}.`]),
    `${Array(EVIDENCE_MOST_WORDS).fill("word").join(" ")}.`,
  );
  assert.equal(
    wholePassage([
      `${Array(EVIDENCE_MOST_WORDS + 1)
        .fill("word")
        .join(" ")}.`,
    ]),
    null,
  );
});
