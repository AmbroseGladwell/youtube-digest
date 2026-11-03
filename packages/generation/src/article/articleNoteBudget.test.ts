import test from "node:test";
import assert from "node:assert/strict";
import { articleNoteBudget, chaptersTooBigToSkip, mostWordsPerKeyPoint, paragraphsInTheFinalStretch } from "./articleNoteBudget.js";

test("a short piece gets a short note, and a long one more room", () => {
  assert.deepEqual(articleNoteBudget(335), { keyPoints: 3, wordsPerKeyPoint: 25, mostChapters: 1 });
  assert.equal(articleNoteBudget(10535).keyPoints, 7);
  assert.equal(articleNoteBudget(10535).mostChapters, 10);
});

test("the budget never shrinks as an article grows", () => {
  let previous = articleNoteBudget(1);
  for (const words of [400, 401, 1000, 1001, 2500, 2501, 6000, 6001, 50000]) {
    const budget = articleNoteBudget(words);
    assert.ok(budget.keyPoints >= previous.keyPoints && budget.mostChapters >= previous.mostChapters);
    previous = budget;
  }
});

test("the final stretch of a long piece is its last third, by words rather than by paragraphs", () => {
  assert.deepEqual([...paragraphsInTheFinalStretch([1000, 1000, 500, 500])], [2, 3]);
});

test("a short piece is held to its end too, since one chapter can't do it", () => {
  assert.deepEqual([...paragraphsInTheFinalStretch([100, 100, 100])], [2]);
});

test("a chapter holding over a quarter of the piece is too big to skip, at any length", () => {
  assert.deepEqual(chaptersTooBigToSkip([100, 100, 100, 100], [0, 3]), [0]);
  assert.deepEqual(chaptersTooBigToSkip([60, 40], [0, 1]), [0, 1]);
  assert.deepEqual(chaptersTooBigToSkip([25, 25, 25, 25], [0, 1, 2, 3]), []);
});

test("a ceiling leaves room over the target, so a near miss doesn't cost a retry", () => {
  assert.equal(mostWordsPerKeyPoint(articleNoteBudget(335)), 32);
});
