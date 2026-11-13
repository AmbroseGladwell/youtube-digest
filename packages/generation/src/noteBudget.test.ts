import test from "node:test";
import assert from "node:assert/strict";
import { chaptersTooBigToSkip, mostWordsPerKeyPoint, noteBudget, positionsInTheFinalStretch, type SourceForm } from "./noteBudget.js";

const counts = (form: SourceForm, words: number) => {
  const { keyPoints, wordsPerKeyPoint, mostChapters } = noteBudget(form, words);
  return { keyPoints, wordsPerKeyPoint, mostChapters };
};

test("a short article keeps the budget it had before", () => {
  assert.deepEqual(counts("written", 335), { keyPoints: 3, wordsPerKeyPoint: 25, mostChapters: 1 });
  assert.deepEqual(counts("written", 1000), { keyPoints: 4, wordsPerKeyPoint: 30, mostChapters: 3 });
  assert.deepEqual(counts("written", 2500), { keyPoints: 5, wordsPerKeyPoint: 40, mostChapters: 5 });
  assert.deepEqual(counts("written", 6000), { keyPoints: 6, wordsPerKeyPoint: 40, mostChapters: 7 });
});

test("a video up to 6,000 words keeps seven points of 40 words", () => {
  for (const words of [0, 400, 2500, 6000]) {
    assert.deepEqual(counts("spoken", words), { keyPoints: 7, wordsPerKeyPoint: 40, mostChapters: 10 });
  }
  assert.equal(mostWordsPerKeyPoint(noteBudget("spoken", 6000)), 50);
});

test("a long source of either form shares the long rows, up to ten points of 60 words", () => {
  for (const form of ["spoken", "written"] as const) {
    assert.deepEqual(counts(form, 6001), { keyPoints: 8, wordsPerKeyPoint: 50, mostChapters: 14 });
    assert.deepEqual(counts(form, 12000), { keyPoints: 8, wordsPerKeyPoint: 50, mostChapters: 14 });
    assert.deepEqual(counts(form, 18000), { keyPoints: 10, wordsPerKeyPoint: 60, mostChapters: 20 });
  }
});

test("only a source over 6,000 words is long", () => {
  assert.equal(noteBudget("spoken", 6000).long, false);
  assert.equal(noteBudget("spoken", 6001).long, true);
  assert.equal(noteBudget("written", 6001).long, true);
});

test("the budget never shrinks as a source grows", () => {
  for (const form of ["spoken", "written"] as const) {
    let previous = noteBudget(form, 1);
    for (const words of [400, 401, 1000, 1001, 2500, 2501, 6000, 6001, 12000, 12001, 50000]) {
      const budget = noteBudget(form, words);
      assert.ok(budget.keyPoints >= previous.keyPoints && budget.wordsPerKeyPoint >= previous.wordsPerKeyPoint);
      assert.ok(budget.mostChapters >= previous.mostChapters && budget.bigPictureWords >= previous.bigPictureWords);
      previous = budget;
    }
  }
});

test("the big picture is on the same budget, and a short source earns none", () => {
  assert.equal(noteBudget("spoken", 900).bigPictureWords, 0);
  assert.equal(noteBudget("written", 900).bigPictureWords, 0);
  assert.equal(noteBudget("spoken", 18000).bigPictureWords, 120);
});

test("the final stretch is the last third, by words rather than by positions", () => {
  assert.deepEqual([...positionsInTheFinalStretch([1000, 1000, 500, 500])], [2, 3]);
});

test("a short source is held to its end too, since one chapter can't do it", () => {
  assert.deepEqual([...positionsInTheFinalStretch([100, 100, 100])], [2]);
});

test("a chapter holding over a quarter of the source is too big to skip", () => {
  assert.deepEqual(chaptersTooBigToSkip([100, 100, 100, 100], [0, 3]), [0]);
  assert.deepEqual(chaptersTooBigToSkip([60, 40], [0, 1]), [0, 1]);
  assert.deepEqual(chaptersTooBigToSkip([25, 25, 25, 25], [0, 1, 2, 3]), []);
});

test("a ceiling leaves room over the target, so a near miss doesn't cost a retry", () => {
  assert.equal(mostWordsPerKeyPoint(noteBudget("written", 335)), 32);
  assert.equal(mostWordsPerKeyPoint(noteBudget("spoken", 18000)), 75);
});

test("a written piece with more headed parts than its row has points takes the next row's counts", () => {
  assert.deepEqual(counts("written", 1401), { keyPoints: 5, wordsPerKeyPoint: 40, mostChapters: 5 });
  const dense = noteBudget("written", 1401, 8);
  assert.deepEqual(
    { keyPoints: dense.keyPoints, wordsPerKeyPoint: dense.wordsPerKeyPoint, mostChapters: dense.mostChapters },
    {
      keyPoints: 6,
      wordsPerKeyPoint: 40,
      mostChapters: 7,
    },
  );
  assert.equal(dense.bigPictureWords, noteBudget("written", 1401).bigPictureWords);
});

test("headed parts no more than the row's points change nothing", () => {
  assert.deepEqual(noteBudget("written", 1401, 5), noteBudget("written", 1401));
  assert.deepEqual(noteBudget("written", 335, 3), noteBudget("written", 335));
});

test("a dense piece below the long rows gets more points without becoming long", () => {
  const dense = noteBudget("written", 4500, 15);
  assert.equal(dense.keyPoints, 8);
  assert.equal(dense.mostChapters, 14);
  assert.equal(dense.long, false);
  assert.equal(dense.wordsPerKeyPoint, 40);
});

test("the last row has nothing above it, however many headings", () => {
  assert.deepEqual(noteBudget("written", 18000, 40), noteBudget("written", 18000));
});
