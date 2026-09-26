import assert from "node:assert/strict";
import test from "node:test";
import type { OutboxEntry } from "./OutboxEntry.js";
import { rebasePendingChanges } from "./rebasePendingChanges.js";

const entry = (change: OutboxEntry["change"], updatedAt = "2026-09-26T10:00:00.000Z"): OutboxEntry => ({
  key: 1,
  kind: "overview",
  id: "a",
  updatedAt,
  change,
  stuck: null,
});

const remote = { id: "a", topicIds: ["t1"], captureReason: null, schemaVersion: 4, updatedAt: "2026-09-26T09:00:00.000Z" };

test("a pulled record with nothing pending is left as it came", () => {
  assert.deepEqual(rebasePendingChanges(remote, []), remote);
});

test("a pending field write goes back on top of the pulled record, dated by the local write", () => {
  const rebased = rebasePendingChanges(remote, [entry({ op: "topics", topicIds: ["t2"] })]);
  assert.deepEqual(rebased, { ...remote, topicIds: ["t2"], updatedAt: "2026-09-26T10:00:00.000Z" });
});

test("pending writes are replayed in order, so the later one wins", () => {
  const rebased = rebasePendingChanges(remote, [
    entry({ op: "captureReason", captureReason: "first" }, "2026-09-26T10:00:00.000Z"),
    entry({ op: "captureReason", captureReason: "second" }, "2026-09-26T10:01:00.000Z"),
  ]);
  assert.equal(rebased?.captureReason, "second");
  assert.equal(rebased?.updatedAt, "2026-09-26T10:01:00.000Z");
});

test("a pending state patch keeps every field it did not name", () => {
  const rebased = rebasePendingChanges(
    { overviewId: "a", read: false, favourite: true, userTags: ["x"], schemaVersion: 1 },
    [{ ...entry({ op: "state", patch: { read: true } }), kind: "overviewState" }],
  );
  assert.equal(rebased?.read, true);
  assert.equal(rebased?.favourite, true);
  assert.deepEqual(rebased?.userTags, ["x"]);
});

test("a pending settings patch merges sectionsEnabled one level deep", () => {
  const rebased = rebasePendingChanges(
    { sectionsEnabled: { verdict: true, selling: true, chapters: false }, readerContext: null, schemaVersion: 1 },
    [{ ...entry({ op: "settings", patch: { sectionsEnabled: { verdict: false } } }), kind: "settings" }],
  );
  assert.deepEqual(rebased?.sectionsEnabled, { verdict: false, selling: true, chapters: false });
});

test("a pending whole-record replace keeps the local record rather than the pulled one", () => {
  const local = { id: "a", coreClaim: "regenerated", schemaVersion: 4, updatedAt: "2026-09-26T10:00:00.000Z" };
  assert.deepEqual(rebasePendingChanges(remote, [entry({ op: "replace", record: local })]), local);
});

test("a pending delete means the pulled record must not come back", () => {
  assert.equal(rebasePendingChanges(remote, [entry({ op: "delete" })]), null);
});
