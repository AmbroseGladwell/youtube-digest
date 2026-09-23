import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OverviewState, DEFAULT_OVERVIEW_STATE } from "./OverviewState.js";
import { OverviewId } from "./Brands.js";

test("the default overview state (unread, unfavourited, no user tags) validates once an overviewId is attached", () => {
  const state: OverviewState = {
    overviewId: OverviewId.parse(randomUUID()),
    ...DEFAULT_OVERVIEW_STATE,
  };
  assert.doesNotThrow(() => OverviewState.parse(state));
  assert.equal(state.read, false);
  assert.equal(state.favourite, false);
  assert.deepEqual(state.userTags, []);
});

test("a user tag must be lowercase and hyphenated, same as a model tag", () => {
  const overviewId = randomUUID();
  assert.doesNotThrow(() =>
    OverviewState.parse({ overviewId, ...DEFAULT_OVERVIEW_STATE, userTags: ["re-watch"] }),
  );
  assert.throws(() =>
    OverviewState.parse({ overviewId, ...DEFAULT_OVERVIEW_STATE, userTags: ["Re-Watch"] }),
  );
});
