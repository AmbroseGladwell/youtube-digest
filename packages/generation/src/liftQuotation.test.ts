import test from "node:test";
import assert from "node:assert/strict";
import { EVIDENCE_MOST_WORDS } from "@overview/domain";
import { liftQuotation } from "./liftQuotation.js";

const segment = (text: string, at: number) => ({ text, startMs: at * 1000, endMs: at * 1000 + 1000 });

test("a quotation is the segments' own words, joined, timed from the first to the last", () => {
  assert.deepEqual(liftQuotation([segment("you're not going to", 4), segment("out-train a bad diet", 5)]), {
    text: "you're not going to out-train a bad diet",
    range: { startMs: 4000, endMs: 6000 },
  });
});

test("a caption's annotation is not quoted as speech", () => {
  assert.equal(liftQuotation([segment("[Music] so here's the thing", 0)])?.text, "so here's the thing");
  assert.equal(liftQuotation([segment("[Music]", 0)]), null);
});

test("a long stretch is cut at whole segments and says so, and its time ends where the quote does", () => {
  const long = Array.from({ length: 10 }, (_, at) => segment(Array(8).fill(`w${at}`).join(" "), at));
  const lifted = liftQuotation(long);
  assert.ok(lifted);
  assert.ok(lifted.text.endsWith("…"));
  assert.ok(lifted.text.split(" ").length <= EVIDENCE_MOST_WORDS);
  assert.deepEqual(lifted.range, { startMs: 0, endMs: 5000 });
});

test("one segment longer than the cap is cut mid-segment rather than dropped", () => {
  const lifted = liftQuotation([segment(Array(60).fill("word").join(" "), 0)]);
  assert.equal(lifted?.text, `${Array(EVIDENCE_MOST_WORDS).fill("word").join(" ")}…`);
});
