import test from "node:test";
import assert from "node:assert/strict";
import { actionsByVideo, readerSpread, sameActions, wordOverlap } from "./readerSpread.js";
import { personalisedVerdict } from "./readerSpreadMarkdown.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";
import { SPREAD_READERS } from "./spreadReaders.js";

const ran = (videoId: string, items: string[]) => makeRunRecord({ videoId, overview: makeOverview({ howToApply: { items } }) });

test("the same actions are the same however they are cased or punctuated, and in order", () => {
  assert.equal(sameActions(["Plan a week of meals."], ["plan a week of meals"]), true);
  assert.equal(sameActions(["Plan meals.", "Shop once."], ["Shop once.", "Plan meals."]), false);
  assert.equal(sameActions([], []), true);
});

test("word overlap is 1 for the same words, 0 for none shared, and two empty lists agree", () => {
  assert.equal(wordOverlap(["Plan a week of meals."], ["plan a week of meals"]), 1);
  assert.equal(wordOverlap(["Plan meals."], ["Walk daily."]), 0);
  assert.equal(wordOverlap([], []), 1);
  assert.equal(wordOverlap(["Plan meals."], []), 0);
});

test("a video is compared only once every reader's overview passed", () => {
  const byVideo = actionsByVideo(
    new Map([
      ["parent", [ran("one", ["Batch-cook on Sunday."]), ran("two", ["Nap before a night shift."])]],
      ["founder", [ran("one", ["Cook once for the week."]), makeRunRecord({ videoId: "two", outcome: "failed" })]],
    ]),
  );

  assert.deepEqual([...byVideo.keys()], ["one"]);
});

test("an empty How to apply is an answer, not a missing one", () => {
  const byVideo = actionsByVideo(new Map([["parent", [ran("one", [])]]]));

  assert.deepEqual(byVideo.get("one")?.get("parent"), []);
});

test("the same video gives different actions for two different readers, and the run says so", () => {
  const byVideo = actionsByVideo(
    new Map([
      ["nobody", [ran("one", ["Plan a week of meals before shopping."])]],
      ["nobody-again", [ran("one", ["Plan your meals for the week before you shop."])]],
      ["parent", [ran("one", ["Batch-cook toddler dinners on your day off between night shifts."])]],
      ["founder", [ran("one", ["Block thirty minutes on Sunday to plan lunches around sales calls."])]],
    ]),
  );

  const spread = readerSpread(["nobody", "nobody-again", "parent", "founder"], byVideo);

  const between = spread.pairs.find((pair) => pair.left === "parent" && pair.right === "founder")!;
  const noise = spread.pairs.find((pair) => pair.left === "nobody" && pair.right === "nobody-again")!;
  assert.equal(between.identical, 0);
  assert.ok(between.meanWordOverlap! < noise.meanWordOverlap!);
  assert.equal(spread.sameForEveryone, 0);
  assert.match(personalisedVerdict(spread), /^Every pair of readers overlaps less/);
});

test("actions that ignore the reader are caught: the same for everyone, and no further apart than sampling", () => {
  const generic = ["Prioritise connection."];
  const byVideo = actionsByVideo(new Map(["nobody", "nobody-again", "parent", "founder"].map((name) => [name, [ran("one", generic)]])));

  const spread = readerSpread(["nobody", "nobody-again", "parent", "founder"], byVideo);

  assert.equal(spread.sameForEveryone, 1);
  assert.match(personalisedVerdict(spread), /^1 of 1 reader pairs overlap as much as two runs for nobody/);
});

test("how many actions each reader got is counted from 0 to 3", () => {
  const byVideo = actionsByVideo(new Map([["parent", [ran("one", []), ran("two", ["A.", "B.", "C."]), ran("three", ["A."])]]]));

  assert.deepEqual(readerSpread(["parent"], byVideo).itemCounts, { parent: [1, 1, 0, 1] });
});

test("the readers are genuinely different, and two of them are nobody, for the noise floor", () => {
  const contexts = SPREAD_READERS.map((reader) => reader.readerContext);
  assert.deepEqual(contexts.slice(0, 2), [null, null]);
  assert.equal(new Set(contexts.slice(2)).size, 3);
  assert.ok(contexts.slice(2).every((context) => context !== null && context.startsWith("I'm")));
});
