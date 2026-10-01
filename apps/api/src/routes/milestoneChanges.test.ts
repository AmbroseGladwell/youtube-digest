import test from "node:test";
import assert from "node:assert/strict";
import { milestoneChanges } from "./milestoneChanges.js";

const CROSSED = { crossedAt: "2026-10-01T09:00:00.000Z", dismissedAt: null };
const DISMISSED = { ...CROSSED, dismissedAt: "2026-10-01T10:00:00.000Z" };

test("a milestone with no stored mark has just been crossed", () => {
  assert.deepEqual(milestoneChanges({}, { "30m": CROSSED, "1h": CROSSED }), { "30m": "crossed", "1h": "crossed" });
});

test("setting dismissedAt is a dismissal and clearing it is an undo", () => {
  assert.deepEqual(milestoneChanges({ "30m": CROSSED }, { "30m": DISMISSED }), { "30m": "dismissed" });
  assert.deepEqual(milestoneChanges({ "30m": DISMISSED }, { "30m": CROSSED }), { "30m": "restored" });
});

test("a mark written again unchanged is not a change, and a missing record counts as none", () => {
  assert.deepEqual(milestoneChanges({ "30m": CROSSED }, { "30m": CROSSED }), {});
  assert.deepEqual(milestoneChanges(undefined, { "30m": CROSSED }), { "30m": "crossed" });
});
