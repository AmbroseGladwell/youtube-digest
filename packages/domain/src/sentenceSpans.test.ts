import test from "node:test";
import assert from "node:assert/strict";
import { sentenceSpans } from "./sentenceSpans.js";

const sentencesOf = (text: string) => sentenceSpans(text).map(({ start, end }) => text.slice(start, end));

test("splits at each sentence's end, keeping abbreviations and decimals inside", () => {
  assert.deepEqual(sentencesOf("Take approx. 1.5 g a day. Rest, e.g. on Sundays! Then what?"), [
    "Take approx. 1.5 g a day.",
    "Rest, e.g. on Sundays!",
    "Then what?",
  ]);
});

test("a sentence may start or end inside bold or italic marks", () => {
  assert.deepEqual(sentencesOf("**It works.** _Mostly_ it does. *Not always.* `npm` runs it."), [
    "**It works.**",
    "_Mostly_ it does.",
    "*Not always.*",
    "`npm` runs it.",
  ]);
});

test("an aside in brackets joins the sentence before it", () => {
  assert.deepEqual(sentencesOf("Stir well. (Gently.) Serve."), ["Stir well. (Gently.)", "Serve."]);
});
