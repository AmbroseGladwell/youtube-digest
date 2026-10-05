import assert from "node:assert/strict";
import test from "node:test";
import { defineCaptureQueueStoreConformanceSuite, makeQueuedCapture } from "@overview/store-conformance";
import { IndexedDbCaptureQueueStore } from "./IndexedDbCaptureQueueStore.js";
import { openEnrolledDatabase, openTestDatabase, readOutbox } from "./enrolledDatabase.testHelper.js";

defineCaptureQueueStoreConformanceSuite(
  "IndexedDbCaptureQueueStore",
  async () => new IndexedDbCaptureQueueStore(await openTestDatabase()),
);

test("the queue is this device's own: queuing in an enrolled library journals nothing", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbCaptureQueueStore(db);
  await store.enqueue([makeQueuedCapture()]);
  assert.deepEqual(await readOutbox(db), []);
});
