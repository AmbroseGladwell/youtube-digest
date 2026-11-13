import test from "node:test";
import assert from "node:assert/strict";
import { isInProject, memberChangeTime, mergeProjectMember, projectMemberId } from "./ProjectMember.js";

const PROJECT = "7a1d3c1e-5d0a-4b8e-9d55-0d1f6a0f2b11";
const OVERVIEW = "0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10";
const base = { id: projectMemberId(PROJECT, OVERVIEW), projectId: PROJECT, overviewId: OVERVIEW };
const reader = { by: "reader" };
const claude = { by: "assistant", connectionId: "conn-1", name: "Claude" };

const add = (at: string, by: object = reader) => ({ addedAt: at, addedBy: by });
const remove = (at: string) => ({ removedAt: at });

const applyAll = (changes: Array<Record<string, unknown>>) => changes.reduce((record, change) => mergeProjectMember(record, change), base);

const membership = (record: Record<string, unknown>) =>
  isInProject({ addedAt: record.addedAt as string, removedAt: record.removedAt as string | null });

test("adding an overview that was never in the project puts the overview in the project", () => {
  const record = mergeProjectMember(base, add("2026-11-12T10:00:00.000Z"));
  assert.equal(record.removedAt, null);
  assert.ok(membership(record));
});

test("an add and a later remove settle the same way whichever arrives first", () => {
  const changes = [add("2026-11-12T10:00:00.000Z"), remove("2026-11-12T11:00:00.000Z")];
  const inOrder = applyAll(changes);
  const reversed = applyAll([...changes].reverse());
  assert.deepEqual(inOrder, reversed);
  assert.equal(membership(inOrder), false);
});

test("a remove then a later add puts it back, whichever arrives first", () => {
  const changes = [add("2026-11-12T10:00:00.000Z"), remove("2026-11-12T11:00:00.000Z"), add("2026-11-12T12:00:00.000Z")];
  const orders = [changes, [changes[2]!, changes[0]!, changes[1]!], [changes[1]!, changes[2]!, changes[0]!]];
  const results = orders.map(applyAll);
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.ok(membership(results[0]!));
});

test("two adds keep the later one and whoever made it", () => {
  const record = applyAll([add("2026-11-12T12:00:00.000Z", claude), add("2026-11-12T10:00:00.000Z", reader)]);
  assert.equal(record.addedAt, "2026-11-12T12:00:00.000Z");
  assert.deepEqual(record.addedBy, claude);
});

test("an earlier remove arriving after a later add does not take the overview out", () => {
  const record = applyAll([add("2026-11-12T12:00:00.000Z"), remove("2026-11-12T11:00:00.000Z")]);
  assert.ok(membership(record));
});

test("an add and a remove at the same moment leave it out", () => {
  const record = applyAll([add("2026-11-12T12:00:00.000Z"), remove("2026-11-12T12:00:00.000Z")]);
  assert.equal(membership(record), false);
});

test("merging the same change twice is the same as once", () => {
  const once = applyAll([add("2026-11-12T10:00:00.000Z")]);
  const twice = applyAll([add("2026-11-12T10:00:00.000Z"), add("2026-11-12T10:00:00.000Z")]);
  assert.deepEqual(once, twice);
});

test("a change is stamped after the last one known, even when the clock has not moved on", () => {
  const record = applyAll([add("2026-11-12T12:00:00.000Z")]);
  const at = memberChangeTime(record, new Date("2026-11-12T12:00:00.000Z"));
  assert.equal(at, "2026-11-12T12:00:00.001Z");
  assert.equal(membership(mergeProjectMember(record, remove(at))), false);
});

test("a change to a membership record never seen is stamped now", () => {
  assert.equal(memberChangeTime(undefined, new Date("2026-11-12T12:00:00.000Z")), "2026-11-12T12:00:00.000Z");
});
