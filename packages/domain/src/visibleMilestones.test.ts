import test from "node:test";
import assert from "node:assert/strict";
import type { MilestoneMarks } from "./Milestone.js";
import { newlyCrossedMilestones, visibleMilestones } from "./visibleMilestones.js";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const crossed = (hours: number, dismissedAt: string | null = null) => ({ crossedAt: hoursAgo(hours), dismissedAt });
const ids = (milestones: { id: string }[]) => milestones.map((milestone) => milestone.id);

test("every milestone the total has reached and that has no mark yet is newly crossed, shortest first", () => {
  assert.deepEqual(ids(newlyCrossedMilestones({}, 304)), ["30m", "1h", "5h"]);
});

test("a milestone already marked is never crossed twice, even after dropping below it and back", () => {
  assert.deepEqual(ids(newlyCrossedMilestones({ "30m": crossed(48) }, 63)), ["1h"]);
});

test("a milestone shows for 24 hours from its crossing and is gone after, seen or not", () => {
  const marks: MilestoneMarks = { "30m": crossed(25), "1h": crossed(23) };

  assert.deepEqual(ids(visibleMilestones(marks, 63, NOW)), ["1h"]);
});

test("a dismissed milestone does not show", () => {
  assert.deepEqual(ids(visibleMilestones({ "30m": crossed(1, hoursAgo(0.5)) }, 32, NOW)), []);
});

test("a milestone the total has dropped back below hides until it is reached again", () => {
  const marks: MilestoneMarks = { "30m": crossed(1) };

  assert.deepEqual(ids(visibleMilestones(marks, 25, NOW)), []);
  assert.deepEqual(ids(visibleMilestones(marks, 32, NOW)), ["30m"]);
});

test("several crossed at once stack shortest first", () => {
  const marks: MilestoneMarks = { "5h": crossed(0), "30m": crossed(0), "1h": crossed(0) };

  assert.deepEqual(ids(visibleMilestones(marks, 304, NOW)), ["30m", "1h", "5h"]);
});

test("a milestone another device stamped a moment ahead of this clock still shows", () => {
  assert.deepEqual(ids(visibleMilestones({ "30m": crossed(-0.01) }, 32, NOW)), ["30m"]);
});
