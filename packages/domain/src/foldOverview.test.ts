import assert from "node:assert/strict";
import test from "node:test";
import { changedFields, foldFiling, foldOverviewState } from "./foldOverview.js";

test("topics and tags are a union with the winner's first, and the capture reason is the winner's unless it has none", () => {
  const folded = foldFiling(
    { topicIds: ["a", "b"], tags: ["one", "two"], captureReason: null },
    { topicIds: ["b", "c"], tags: ["two", "three"], captureReason: "Because" },
  );

  assert.deepEqual(folded, { topicIds: ["a", "b", "c"], tags: ["one", "two", "three"], captureReason: "Because" });
});

test("a winner's capture reason is kept over the loser's", () => {
  const folded = foldFiling(
    { topicIds: [], tags: [], captureReason: "Mine" },
    { topicIds: [], tags: [], captureReason: "Theirs" },
  );

  assert.equal(folded.captureReason, "Mine");
});

test("the tag union is capped at what a record may hold, keeping the winner's tags", () => {
  const folded = foldFiling(
    { topicIds: [], tags: ["a", "b", "c", "d"], captureReason: null },
    { topicIds: [], tags: ["e", "f", "g", "h"], captureReason: null },
  );

  assert.deepEqual(folded.tags, ["a", "b", "c", "d", "e", "f"]);
});

test("read and favourite are kept if either copy had them, and user tags are a union", () => {
  const folded = foldOverviewState(
    { read: false, favourite: true, userTags: ["later"] },
    { read: true, favourite: false, userTags: ["later", "work"] },
  );

  assert.deepEqual(folded, { read: true, favourite: true, userTags: ["later", "work"] });
});

test("only the fields a fold changed are reported, comparing lists by their items", () => {
  const before = { read: false, favourite: false, userTags: ["a"] };

  assert.deepEqual(changedFields(before, { read: true, favourite: false, userTags: ["a"] }), { read: true });
  assert.deepEqual(changedFields(before, { read: false, favourite: false, userTags: ["a", "b"] }), { userTags: ["a", "b"] });
  assert.deepEqual(changedFields(before, { ...before }), {});
});
