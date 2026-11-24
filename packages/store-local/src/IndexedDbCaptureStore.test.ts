import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import { CURRENT_SCHEMA_VERSIONS, OverviewId, SourceKey, youTubeSource, type Capture, type RecordChange } from "@overview/domain";
import { IndexedDbCaptureStore } from "./IndexedDbCaptureStore.js";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { IndexedDbTranscriptStore } from "./IndexedDbTranscriptStore.js";
import { openEnrolledDatabase, openTestDatabase, readOutbox } from "./enrolledDatabase.testHelper.js";

const now = () => new Date("2026-11-23T10:00:00.000Z");

const kept = (overrides: Partial<Capture> = {}): Capture =>
  ({
    id: OverviewId.parse(randomUUID()),
    sourceKey: SourceKey.parse("dQw4w9WgXcQ"),
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    keptAt: "2026-11-23T09:00:00.000Z",
    keptFrom: "phone",
    captureReason: null,
    title: null,
    thumbnailUrl: null,
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "kept",
    source: null,
    waitingFor: "server",
    resumesAt: "2026-11-24T00:00:00.000Z",
    queueStatus: "waiting",
    problem: null,
    ...overrides,
  }) as Capture;

const saved = (source: ReturnType<typeof youTubeSource>, overrides: Partial<Capture> = {}): Capture =>
  ({
    ...kept({ sourceKey: SourceKey.parse(source.id), url: source.url }),
    stage: "saved",
    source,
    savedAt: "2026-11-23T09:30:00.000Z",
    waitingFor: undefined,
    resumesAt: undefined,
    queueStatus: undefined,
    problem: undefined,
    ...overrides,
  }) as Capture;

test("a kept link is read back, found by its source, and listed oldest first", async () => {
  const captures = new IndexedDbCaptureStore(await openTestDatabase());
  const later = kept({ sourceKey: SourceKey.parse("later-video"), keptAt: "2026-11-23T09:05:00.000Z" });
  const first = kept();
  await captures.saveCapture(later);
  await captures.saveCapture(first);

  assert.deepEqual(await captures.getCapture(first.id), first);
  assert.deepEqual(await captures.captureOfSource(first.sourceKey), first);
  assert.deepEqual(
    (await captures.listCaptures()).map((capture) => capture.id),
    [first.id, later.id],
  );
});

test("keeping a link journals it, and removing it journals the delete", async () => {
  const db = await openEnrolledDatabase();
  const captures = new IndexedDbCaptureStore(db);
  const capture = kept();

  await captures.saveCapture(capture);
  await captures.removeCapture(capture.id);

  assert.deepEqual(
    (await readOutbox(db)).map((entry) => [entry.kind, entry.change.op]),
    [
      ["capture", "replace"],
      ["capture", "delete"],
    ],
  );
  assert.equal(await captures.getCapture(capture.id), null);
});

test("a saved capture journals its transcript behind it, and the transcript is pushed while it is saved", async () => {
  const db = await openEnrolledDatabase();
  const transcript = makeStoredTranscript();
  await new IndexedDbTranscriptStore(db).saveTranscript(transcript);
  const captures = new IndexedDbCaptureStore(db);
  const capture = saved(youTubeSource(transcript.video!));
  const storage = new IndexedDbSyncStorage(db, { now });

  await captures.saveCapture(capture);
  const pushed = await storage.transcriptToPush(transcript.videoId);
  await captures.removeCapture(capture.id);

  assert.deepEqual(
    (await readOutbox(db)).slice(0, 2).map((entry) => entry.kind),
    ["capture", "transcript"],
  );
  assert.deepEqual(pushed, transcript);
  assert.equal(await storage.transcriptToPush(transcript.videoId), null);
});

test("a kept link has no transcript to push", async () => {
  const db = await openEnrolledDatabase();
  const transcript = makeStoredTranscript();
  await new IndexedDbTranscriptStore(db).saveTranscript(transcript);
  await new IndexedDbCaptureStore(db).saveCapture(kept({ sourceKey: transcript.videoId }));

  assert.equal(await new IndexedDbSyncStorage(db, { now }).transcriptToPush(transcript.videoId), null);
  assert.deepEqual(
    (await readOutbox(db)).map((entry) => entry.kind),
    ["capture"],
  );
});

test("an overview saved under a capture's id takes its place on this device", async () => {
  const db = await openTestDatabase();
  const captures = new IndexedDbCaptureStore(db);
  const transcript = makeStoredTranscript();
  const capture = saved(youTubeSource(transcript.video!));
  await captures.saveCapture(capture);

  await new IndexedDbOverviewStore(db).saveOverview(makeOverview({ id: capture.id, source: capture.source! }));

  assert.equal(await captures.getCapture(capture.id), null);
});

test("a pulled capture lands here, and its tombstone takes it away", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db, { now });
  const capture = kept();
  const { id, ...body } = capture;
  const pulled: RecordChange = {
    kind: "capture",
    id,
    schemaVersion: CURRENT_SCHEMA_VERSIONS.capture,
    rev: 1,
    seq: 3,
    updatedAt: capture.keptAt,
    deleted: false,
    body,
  };

  await storage.applyChanges([pulled], 3);
  const landed = await new IndexedDbCaptureStore(db).getCapture(id);
  await storage.applyChanges([{ ...pulled, rev: 2, seq: 4, updatedAt: null, deleted: true, body: undefined }], 4);

  assert.deepEqual(landed, capture);
  assert.equal(await new IndexedDbCaptureStore(db).getCapture(id), null);
});

test("a capture the server refused as a second copy is forgotten here with its pending writes", async () => {
  const db = await openEnrolledDatabase();
  const captures = new IndexedDbCaptureStore(db);
  const capture = kept();
  await captures.saveCapture(capture);

  await new IndexedDbSyncStorage(db, { now }).forgetRecord("capture", capture.id);

  assert.equal(await captures.getCapture(capture.id), null);
  assert.deepEqual(await readOutbox(db), []);
});
