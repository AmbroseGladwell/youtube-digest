import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { defineCaptureQueueStoreConformanceSuite, makeQueuedCapture } from "@overview/store-conformance";
import { CURRENT_SCHEMA_VERSIONS, OverviewId, VideoId } from "@overview/domain";
import { IndexedDbCaptureQueueStore } from "./IndexedDbCaptureQueueStore.js";
import { IndexedDbCaptureStore } from "./IndexedDbCaptureStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { CAPTURE_QUEUE_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, putRaw, readOutbox, readRaw } from "./enrolledDatabase.testHelper.js";

const queueOn = (db: IDBDatabase) => new IndexedDbCaptureQueueStore(db, new IndexedDbCaptureStore(db));

defineCaptureQueueStoreConformanceSuite("IndexedDbCaptureQueueStore", async () => queueOn(await openTestDatabase()));

test("queuing in an enrolled library journals each video as a capture, so every device sees it", async () => {
  const db = await openEnrolledDatabase();
  await queueOn(db).enqueue([makeQueuedCapture()]);

  assert.deepEqual(
    (await readOutbox(db)).map((entry) => [entry.kind, entry.change.op]),
    [["capture", "replace"]],
  );
});

test("a video queued on another device comes down as a capture and joins this device's queue", async () => {
  const db = await openEnrolledDatabase();
  const queued = makeQueuedCapture({ videoId: VideoId.parse("from-phone") });
  const elsewhere = await openTestDatabase();
  await queueOn(elsewhere).enqueue([queued]);
  const [capture] = await new IndexedDbCaptureStore(elsewhere).listCaptures();
  const { id, ...body } = capture!;

  await new IndexedDbSyncStorage(db, { now: () => new Date() }).applyChanges(
    [
      {
        kind: "capture",
        id,
        schemaVersion: CURRENT_SCHEMA_VERSIONS.capture,
        rev: 1,
        seq: 1,
        updatedAt: capture!.keptAt,
        deleted: false,
        body,
      },
    ],
    1,
  );

  assert.deepEqual(await queueOn(db).listQueue(), [queued]);
});

test("what this device queued before the queue synced joins it once, and the old queue empties", async () => {
  const db = await openEnrolledDatabase();
  const queued = makeQueuedCapture({ videoId: VideoId.parse("from-before") });
  await putRaw(db, CAPTURE_QUEUE_STORE, queued);

  const first = await queueOn(db).listQueue();
  const again = await queueOn(db).listQueue();

  assert.deepEqual(first, [queued]);
  assert.deepEqual(again, [queued]);
  assert.equal((await readOutbox(db)).length, 1);
  assert.equal(await readRaw(db, CAPTURE_QUEUE_STORE, queued.videoId), undefined);
});

test("only playlist videos waiting in line are the queue's: a kept link is not", async () => {
  const db = await openTestDatabase();
  await new IndexedDbCaptureStore(db).saveCapture({
    id: OverviewId.parse(randomUUID()),
    sourceKey: VideoId.parse("kept-link"),
    url: "https://www.youtube.com/watch?v=kept-link",
    keptAt: "2026-11-24T09:00:00.000Z",
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
    resumesAt: null,
    queueStatus: "waiting",
    problem: null,
  });

  assert.deepEqual(await queueOn(db).listQueue(), []);
});
