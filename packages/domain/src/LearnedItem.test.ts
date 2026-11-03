import test from "node:test";
import assert from "node:assert/strict";
import { keptLearnedItems, learnedItemKey, profilePassIsDue, removedLearnedItems, unnoticedLearnedItems, type LearnedItem } from "./LearnedItem.js";

const item = (overrides: Partial<LearnedItem>): LearnedItem => ({
  text: "building an app",
  source: "From 2 overviews on tech",
  learnedAt: "2026-11-01T10:00:00.000Z",
  noticedAt: null,
  removedAt: null,
  ...overrides,
});

test("the pass is due once three overviews have been made since the last one, and not while learning is off", () => {
  assert.equal(profilePassIsDue({ overviewCount: 2, countAtLastPass: 0, keepLearning: true }), false);
  assert.equal(profilePassIsDue({ overviewCount: 3, countAtLastPass: 0, keepLearning: true }), true);
  assert.equal(profilePassIsDue({ overviewCount: 5, countAtLastPass: 3, keepLearning: true }), false);
  assert.equal(profilePassIsDue({ overviewCount: 9, countAtLastPass: 0, keepLearning: false }), false);
});

test("a key doesn't care about case or spacing, so the same item can't arrive twice", () => {
  assert.equal(learnedItemKey("  Building  an App "), "building an app");
});

test("kept items come newest first, and a removed one is held apart", () => {
  const older = item({ text: "older" });
  const newer = item({ text: "newer", learnedAt: "2026-11-02T10:00:00.000Z" });
  const gone = item({ text: "gone", removedAt: "2026-11-02T11:00:00.000Z" });
  const learned = { older, newer, gone };

  assert.deepEqual(keptLearnedItems(learned), [newer, older]);
  assert.deepEqual(removedLearnedItems(learned), [gone]);
});

test("the notice shows what the reader hasn't been told about, and never a removed item", () => {
  const told = item({ text: "told", noticedAt: "2026-11-01T11:00:00.000Z" });
  const fresh = item({ text: "fresh" });
  const gone = item({ text: "gone", removedAt: "2026-11-02T11:00:00.000Z" });

  assert.deepEqual(unnoticedLearnedItems({ told, fresh, gone }), [fresh]);
});
