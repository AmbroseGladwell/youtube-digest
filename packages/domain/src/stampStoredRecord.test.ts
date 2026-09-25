import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Overview } from "./Overview.js";
import { OverviewState } from "./OverviewState.js";
import { applyRecordMigration } from "./migrateRecord.js";
import { stampStoredRecord } from "./stampStoredRecord.js";
import { storedSchemaVersion } from "./storedSchemaVersion.js";
import { storedUpdatedAt } from "./storedUpdatedAt.js";

const WRITTEN_AT = new Date("2026-09-24T09:15:00.000Z");

const overview = {
  id: randomUUID(),
  video: {
    id: "example",
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: null,
    publishedAt: null,
    thumbnailUrl: null,
  },
  savedAt: new Date().toISOString(),
  captureReason: null,
  inOneLine: "A short description of the video.",
  coreClaim: "The single assertion this video makes.",
  thin: false,
  keyPoints: ["one", "two", "three"],
  topicIds: [] as string[],
  tags: ["one-tag", "two-tag", "three-tag"],
  verdict: null,
  selling: null,
  howToApply: null,
  watchAnyway: null,
  chapters: null,
};

test("a stamped record carries both the version it was written at and the time", () => {
  const stamped = stampStoredRecord({ id: "a" }, 3, WRITTEN_AT);

  assert.equal(storedSchemaVersion(stamped), 3);
  assert.equal(storedUpdatedAt(stamped), "2026-09-24T09:15:00.000Z");
});

test("stamping changes nothing else about the record", () => {
  const { schemaVersion, updatedAt, ...rest } = stampStoredRecord(overview, 2, WRITTEN_AT) as Record<
    string,
    unknown
  >;

  assert.deepEqual(rest, overview);
});

test("both stamps come off again on read, because zod strips what the schema does not name", () => {
  const stamped = stampStoredRecord(overview, 2, WRITTEN_AT);

  assert.deepEqual(Overview.parse(stamped), overview);
});

test("a state record stamped on write reads back without either key", () => {
  const state = { overviewId: randomUUID(), read: true, favourite: false, userTags: ["one-tag"] };

  assert.deepEqual(OverviewState.parse(stampStoredRecord(state, 1, WRITTEN_AT)), state);
});

test("a record with no updatedAt is undated rather than dated wrongly", () => {
  assert.equal(storedUpdatedAt({ id: "a", schemaVersion: 2 }), null);
  assert.equal(storedUpdatedAt({ id: "a", updatedAt: 1758702900000 }), null);
  assert.equal(storedUpdatedAt(undefined), null);
});

test("migrating a record does not date it: being read is not being changed", () => {
  const migrated = applyRecordMigration({ id: "a", schemaVersion: 1 }, { newSchemaVersion: 2 });

  assert.equal(storedSchemaVersion(migrated), 2);
  assert.equal(storedUpdatedAt(migrated), null);
});
