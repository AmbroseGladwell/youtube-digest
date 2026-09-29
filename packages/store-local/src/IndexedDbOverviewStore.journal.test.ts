import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview } from "@overview/store-conformance";
import { CURRENT_OVERVIEW_SCHEMA_VERSION, OverviewId, TopicId } from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { OVERVIEWS_STORE, OVERVIEW_STATES_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, readOutbox, readRaw, readRecordOutbox } from "./enrolledDatabase.testHelper.js";

test("a library that was never enrolled journals nothing, whatever is written to it", async () => {
  const db = await openTestDatabase();
  let journaled = 0;
  const store = new IndexedDbOverviewStore(db, { onJournaled: () => (journaled += 1) });
  const overview = makeOverview();

  await store.saveOverview(overview);
  await store.setOverviewState(overview.id, { read: true });
  await store.createTopic({ name: "Finance" });
  await store.deleteOverview(overview.id);

  assert.deepEqual(await readOutbox(db), []);
  assert.equal(journaled, 0);
});

test("saving an overview in an enrolled library journals the stored record, dated by the same write", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbOverviewStore(db, { onJournaled: () => (journaled += 1) });
  const overview = makeOverview();

  await store.saveOverview(overview);

  const stored = await readRaw(db, OVERVIEWS_STORE, overview.id);
  const [entry] = await readOutbox(db);
  assert.equal(journaled, 1);
  assert.equal(entry?.kind, "overview");
  assert.equal(entry?.id, overview.id);
  assert.equal(entry?.updatedAt, stored.updatedAt);
  assert.equal(entry?.stuck, null);
  assert.deepEqual(entry?.change, { op: "replace", record: stored });
  assert.equal((entry?.change as { record: Record<string, unknown> }).record.schemaVersion, CURRENT_OVERVIEW_SCHEMA_VERSION);
});

test("filing an overview journals the topic ids and nothing else about it", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  const topicId = TopicId.parse(randomUUID());
  await store.saveOverview(overview);

  await store.setOverviewTopics(overview.id, [topicId]);

  const entries = await readRecordOutbox(db);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[1]?.change, { op: "topics", topicIds: [topicId] });
  assert.equal(entries[1]?.updatedAt, (await readRaw(db, OVERVIEWS_STORE, overview.id)).updatedAt);
});

test("a capture reason journals as its own field write", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);

  await store.setOverviewCaptureReason(overview.id, "Because");

  assert.deepEqual((await readRecordOutbox(db))[1]?.change, { op: "captureReason", captureReason: "Because" });
});

test("marking read journals only the fields the patch named", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);
  const overviewId = OverviewId.parse(randomUUID());

  await store.setOverviewState(overviewId, { read: true });

  const [entry] = await readOutbox(db);
  assert.equal(entry?.kind, "overviewState");
  assert.equal(entry?.id, overviewId);
  assert.deepEqual(entry?.change, { op: "state", patch: { read: true } });
});

test("creating a topic journals the stored topic record", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);

  const topic = await store.createTopic({ name: "Finance" });

  const [entry] = await readOutbox(db);
  assert.equal(entry?.kind, "topic");
  assert.equal(entry?.id, topic.id);
  assert.equal(entry?.change.op, "replace");
  assert.equal((entry?.change as { record: Record<string, unknown> }).record.name, "Finance");
});

test("deleting an overview takes its state with it and journals one delete", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  await store.setOverviewState(overview.id, { favourite: true });

  await store.deleteOverview(overview.id);

  assert.equal(await readRaw(db, OVERVIEWS_STORE, overview.id), undefined);
  assert.equal(await readRaw(db, OVERVIEW_STATES_STORE, overview.id), undefined);
  const entries = await readOutbox(db);
  assert.deepEqual(entries.at(-1)?.change, { op: "delete" });
  assert.equal(entries.at(-1)?.id, overview.id);
});

test("the journal entry lands in the same transaction as the write, so the two cannot disagree", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbOverviewStore(db);
  const first = makeOverview();
  const second = makeOverview();

  await Promise.all([store.saveOverview(first), store.saveOverview(second)]);

  const entries = await readRecordOutbox(db);
  assert.deepEqual(
    entries.map((entry) => entry.id).sort(),
    [first.id, second.id].sort(),
  );
  assert.ok(entries[0]!.key < entries[1]!.key);
});
