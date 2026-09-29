import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import {
  CURRENT_SCHEMA_VERSIONS,
  DEFAULT_SETTINGS,
  OVERVIEW_CORPUS,
  OverviewId,
  VideoId,
  type RecordChange,
} from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { IndexedDbTranscriptStore } from "./IndexedDbTranscriptStore.js";
import {
  OUTBOX_STORE,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  SETTINGS_KEY,
  SETTINGS_STORE,
  SYNC_REVISIONS_STORE,
  TOPICS_STORE,
  TRANSCRIPTS_STORE,
} from "./localDatabaseSchema.js";
import {
  markEnrolled,
  openEnrolledDatabase,
  openTestDatabase,
  putRaw,
  readOutbox,
  readRaw,
} from "./enrolledDatabase.testHelper.js";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const now = () => NOW;

const change = (overrides: Partial<RecordChange> & Pick<RecordChange, "kind" | "id">): RecordChange => ({
  schemaVersion: CURRENT_SCHEMA_VERSIONS[overrides.kind],
  rev: 1,
  seq: 1,
  updatedAt: "2026-09-26T11:00:00.000Z",
  deleted: false,
  ...overrides,
});

const corpusAt = (version: number) => OVERVIEW_CORPUS.get(version) as Record<string, unknown>;

test("a fresh library is not enrolled, has no cursor and nothing pending", async () => {
  const storage = new IndexedDbSyncStorage(await openTestDatabase(), { now });
  assert.equal(await storage.isEnrolled(), false);
  assert.equal(await storage.cursor(), 0);
  assert.deepEqual(await storage.listPending(), []);
});

test("enrolling journals every record the library holds, at this client's version, and turns journaling on", async () => {
  const db = await openTestDatabase();
  const overviews = new IndexedDbOverviewStore(db);
  const settings = new IndexedDbSettingsStore(db);
  const overview = makeOverview();
  await overviews.saveOverview(overview);
  await overviews.setOverviewState(overview.id, { read: true });
  const topic = await overviews.createTopic({ name: "Finance" });
  await settings.update({ readerContext: "A cook." });
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();

  assert.equal(await storage.isEnrolled(), true);
  const pending = await storage.listPending();
  const byKind = Object.fromEntries(pending.map((entry) => [entry.kind, entry]));
  assert.deepEqual(Object.keys(byKind).sort(), ["overview", "overviewState", "settings", "topic"]);
  assert.deepEqual(byKind.overview?.change, { op: "replace", record: await readRaw(db, OVERVIEWS_STORE, overview.id) });
  assert.deepEqual(byKind.topic?.change, { op: "replace", record: await readRaw(db, TOPICS_STORE, topic.id) });
  assert.deepEqual(byKind.overviewState?.change, { op: "state", patch: { read: true, favourite: false, userTags: [] } });
  assert.deepEqual(byKind.settings?.change, {
    op: "settings",
    patch: { ...DEFAULT_SETTINGS, readerContext: "A cook." },
  });

  await overviews.setOverviewState(overview.id, { favourite: true });
  assert.equal((await storage.listPending()).length, 5);
});

test("enrolling migrates an old record to this client's version and dates it by its own creation", async () => {
  const db = await openTestDatabase();
  const old = corpusAt(1);
  await putRaw(db, OVERVIEWS_STORE, old);
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();

  const [entry] = await storage.listPending();
  assert.equal(entry?.updatedAt, old.savedAt);
  const record = (entry?.change as { record: Record<string, unknown> }).record;
  assert.equal(record.schemaVersion, CURRENT_SCHEMA_VERSIONS.overview);
  assert.equal(record.updatedAt, old.savedAt);
  assert.equal(record.chapters, null);
});

test("enrolling leaves out what this client cannot read, rather than pushing a record it cannot vouch for", async () => {
  const db = await openTestDatabase();
  await putRaw(db, OVERVIEWS_STORE, { ...corpusAt(1), schemaVersion: CURRENT_SCHEMA_VERSIONS.overview + 1 });
  await putRaw(db, OVERVIEW_STATES_STORE, { overviewId: "state-only" });
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();

  const pending = await storage.listPending();
  assert.deepEqual(pending.map((entry) => entry.kind), ["overviewState"]);
  assert.equal(pending[0]?.updatedAt, NOW.toISOString());
});

test("enrolling twice journals the library once", async () => {
  const db = await openTestDatabase();
  await new IndexedDbOverviewStore(db).saveOverview(makeOverview());
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();
  await storage.enrol();

  assert.equal((await storage.listPending()).length, 1);
});

test("acknowledging a write removes it and remembers the revision the server gave the record", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  const [entry] = await storage.listPending();

  await storage.acknowledge(entry!.key, { rev: 3 });

  assert.deepEqual(await storage.listPending(), []);
  assert.equal(await storage.revisionOf("overview", overview.id), 3);
});

test("acknowledging a delete forgets the revision, so a recreation starts clean", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  await putRaw(db, SYNC_REVISIONS_STORE, { kind: "overview", id: "a", rev: 4 });
  await putRaw(db, OUTBOX_STORE, { kind: "overview", id: "a", updatedAt: NOW.toISOString(), change: { op: "delete" }, stuck: null });
  const [entry] = await storage.listPending();

  await storage.acknowledge(entry!.key, { tombstoned: true });

  assert.equal(await storage.revisionOf("overview", "a"), null);
});

test("parking a write keeps it, marked with why, and leaves the others pending", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  const store = new IndexedDbOverviewStore(db);
  await store.saveOverview(makeOverview());
  await store.saveOverview(makeOverview());
  const [first] = await storage.listPending();

  await storage.park(first!.key, { code: "invalid_request", message: "no" });

  const pending = await storage.listPending();
  assert.equal(pending.length, 2);
  assert.deepEqual(pending[0]?.stuck, { code: "invalid_request", message: "no" });
  assert.equal(pending[1]?.stuck, null);
});

test("applying a page writes each record raw with its stamps, remembers its revision, and moves the cursor", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  const overview = makeOverview();
  const { id: _id, ...topicBody } = { id: randomUUID(), name: "Finance", description: null, createdAt: "2026-09-01T00:00:00.000Z" };

  await storage.applyChanges(
    [
      change({ kind: "overview", id: overview.id, rev: 2, seq: 7, body: overview }),
      change({ kind: "overviewState", id: overview.id, rev: 1, seq: 8, body: { overviewId: overview.id, read: true, favourite: false, userTags: [] } }),
      change({ kind: "topic", id: "topic-1", rev: 1, seq: 9, body: topicBody }),
      change({ kind: "settings", id: "settings", rev: 5, seq: 10, body: { ...DEFAULT_SETTINGS, readerContext: "Theirs" } }),
    ],
    10,
  );

  const stored = await readRaw(db, OVERVIEWS_STORE, overview.id);
  assert.deepEqual(stored, { ...overview, schemaVersion: CURRENT_SCHEMA_VERSIONS.overview, updatedAt: "2026-09-26T11:00:00.000Z" });
  assert.equal((await readRaw(db, TOPICS_STORE, "topic-1")).name, "Finance");
  assert.equal((await readRaw(db, SETTINGS_STORE, SETTINGS_KEY)).readerContext, "Theirs");
  assert.equal(await storage.revisionOf("overview", overview.id), 2);
  assert.equal(await storage.revisionOf("settings", "settings"), 5);
  assert.equal(await storage.cursor(), 10);
  assert.deepEqual(await new IndexedDbOverviewStore(db).getOverview(overview.id), overview);
  assert.equal((await new IndexedDbOverviewStore(db).getOverviewState(overview.id)).read, true);
});

test("a tombstone removes the record, its state, and its revision", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  const overview = makeOverview();
  const store = new IndexedDbOverviewStore(db);
  await store.saveOverview(overview);
  await store.setOverviewState(overview.id, { read: true });
  await putRaw(db, SYNC_REVISIONS_STORE, { kind: "overview", id: overview.id, rev: 1 });

  await storage.applyChanges([change({ kind: "overview", id: overview.id, rev: 2, seq: 3, updatedAt: null, deleted: true })], 3);

  assert.equal(await store.getOverview(overview.id), null);
  assert.equal(await readRaw(db, OVERVIEW_STATES_STORE, overview.id), undefined);
  assert.equal(await storage.revisionOf("overview", overview.id), null);
});

test("a pulled record with a pending local write to it shows the local write on top until it is pushed", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  await store.setOverviewState(overview.id, { read: true });
  for (const entry of await storage.listPending()) {
    if (entry.kind === "overview") await storage.acknowledge(entry.key, { rev: 1 });
  }

  await storage.applyChanges(
    [change({ kind: "overviewState", id: overview.id, rev: 1, seq: 2, body: { overviewId: overview.id, read: false, favourite: true, userTags: [] } })],
    2,
  );

  assert.deepEqual(await store.getOverviewState(overview.id), {
    overviewId: overview.id,
    read: true,
    favourite: true,
    userTags: [],
  });
});

test("a parked write is not put back on top of what the server holds", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  const store = new IndexedDbOverviewStore(db);
  const overviewId = OverviewId.parse(randomUUID());
  await store.setOverviewState(overviewId, { read: true });
  const [entry] = await storage.listPending();
  await storage.park(entry!.key, { code: "record_newer_than_client", message: "no" });

  await storage.applyChanges(
    [change({ kind: "overviewState", id: overviewId, body: { overviewId, read: false, favourite: false, userTags: [] } })],
    1,
  );

  assert.equal((await store.getOverviewState(overviewId)).read, false);
});

test("a record this device is about to delete is not brought back by a pull", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  await storage.enrol();
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  await store.deleteOverview(overview.id);

  await storage.applyChanges([change({ kind: "overview", id: overview.id, body: overview })], 1);

  assert.equal(await store.getOverview(overview.id), null);
});

test("leaving keeps every record and drops the bookkeeping", async () => {
  const db = await openTestDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  await storage.enrol();
  await storage.applyChanges([], 9);

  await storage.leave();

  assert.equal(await storage.isEnrolled(), false);
  assert.equal(await storage.cursor(), 0);
  assert.deepEqual(await storage.listPending(), []);
  assert.deepEqual(await store.getOverview(overview.id), overview);
  await store.setOverviewState(overview.id, { read: true });
  assert.deepEqual(await readOutbox(db), []);
});

test("journal listeners hear a notification once per journaled write", async () => {
  const storage = new IndexedDbSyncStorage(await openTestDatabase(), { now });
  const heard: number[] = [];
  const stop = storage.onJournaled(() => heard.push(1));

  storage.notifyJournaled();
  stop();
  storage.notifyJournaled();

  assert.equal(heard.length, 1);
});


const transcriptEntry = (videoId: string, fetchedAt: string) => ({
  kind: "transcript",
  id: videoId,
  updatedAt: fetchedAt,
  change: { op: "transcript" },
});

test("enrolling journals every transcript the library holds by its video, without copying the segments", async () => {
  const db = await openTestDatabase();
  const transcript = makeStoredTranscript();
  await putRaw(db, TRANSCRIPTS_STORE, transcript);
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();

  const [entry] = await storage.listPending();
  assert.deepEqual(
    { kind: entry?.kind, id: entry?.id, updatedAt: entry?.updatedAt, change: entry?.change },
    transcriptEntry(transcript.videoId, transcript.fetchedAt),
  );
});

test("a library enrolled before transcripts were synced journals the transcripts it holds once, and nothing else again", async () => {
  const db = await openTestDatabase();
  await new IndexedDbOverviewStore(db).saveOverview(makeOverview());
  const transcript = makeStoredTranscript();
  await putRaw(db, TRANSCRIPTS_STORE, transcript);
  await markEnrolled(db);
  const storage = new IndexedDbSyncStorage(db, { now });

  assert.equal(await storage.isEnrolled(), false);
  await storage.enrol();
  await storage.enrol();

  assert.equal(await storage.isEnrolled(), true);
  assert.deepEqual(
    (await storage.listPending()).map((entry) => [entry.kind, entry.id]),
    [["transcript", transcript.videoId]],
  );
});

test("enrolling leaves out a transcript this client cannot read", async () => {
  const db = await openTestDatabase();
  await putRaw(db, TRANSCRIPTS_STORE, { videoId: "broken", segments: "not a list" });
  const storage = new IndexedDbSyncStorage(db, { now });

  await storage.enrol();

  assert.deepEqual(await storage.listPending(), []);
});

test("saving a transcript on an enrolled library journals it and says so", async () => {
  const db = await openEnrolledDatabase();
  let heard = 0;
  const transcripts = new IndexedDbTranscriptStore(db, { onJournaled: () => (heard += 1) });
  const transcript = makeStoredTranscript();

  await transcripts.saveTranscript(transcript);

  const [entry] = await readOutbox(db);
  assert.deepEqual(
    { kind: entry?.kind, id: entry?.id, updatedAt: entry?.updatedAt, change: entry?.change },
    transcriptEntry(transcript.videoId, transcript.fetchedAt),
  );
  assert.equal(heard, 1);
});

test("saving a transcript on a library that was never enrolled journals nothing", async () => {
  const db = await openTestDatabase();
  let heard = 0;
  const transcripts = new IndexedDbTranscriptStore(db, { onJournaled: () => (heard += 1) });

  await transcripts.saveTranscript(makeStoredTranscript());

  assert.deepEqual(await readOutbox(db), []);
  assert.equal(heard, 0);
});

test("a transcript kept from the server reads back, and is not journaled to be sent back to it", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  const transcript = makeStoredTranscript({ videoId: VideoId.parse("from-the-server") });

  await storage.keepTranscript(transcript);

  assert.deepEqual(await new IndexedDbTranscriptStore(db).getTranscript(transcript.videoId), transcript);
  assert.deepEqual(await storage.readTranscript(transcript.videoId), transcript);
  assert.deepEqual(await readOutbox(db), []);
});

test("acknowledging a sent transcript removes it and remembers no revision", async () => {
  const db = await openEnrolledDatabase();
  const transcript = makeStoredTranscript();
  await new IndexedDbTranscriptStore(db).saveTranscript(transcript);
  const storage = new IndexedDbSyncStorage(db, { now });
  const [entry] = await storage.listPending();

  await storage.acknowledge(entry!.key, { sent: true });

  assert.deepEqual(await storage.listPending(), []);
  assert.equal(await storage.revisionOf("transcript", transcript.videoId), null);
});
