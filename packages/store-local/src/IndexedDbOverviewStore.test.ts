import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { defineOverviewStoreConformanceSuite } from "@overview/store-conformance";
import { OverviewId, OverviewState } from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { OVERVIEW_STATES_STORE } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";

defineOverviewStoreConformanceSuite("IndexedDbOverviewStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return new IndexedDbOverviewStore(db);
});

test("getOverviewState fills in a field the stored state predates, rather than handing back undefined", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const overviewId = OverviewId.parse(randomUUID());
  await promisifyRequest(
    db
      .transaction(OVERVIEW_STATES_STORE, "readwrite")
      .objectStore(OVERVIEW_STATES_STORE)
      .put({ overviewId, read: true, favourite: false }),
  );

  const state = await new IndexedDbOverviewStore(db).getOverviewState(overviewId);

  assert.deepEqual(state.userTags, []);
  assert.equal(state.read, true);
  assert.doesNotThrow(() => OverviewState.parse(state));
});
