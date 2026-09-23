import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { defineOverviewStoreConformanceSuite, makeOverview } from "@overview/store-conformance";
import { CURRENT_OVERVIEW_SCHEMA_VERSION, OverviewId, OverviewState, TopicId } from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { OVERVIEWS_STORE, OVERVIEW_STATES_STORE } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";

defineOverviewStoreConformanceSuite("IndexedDbOverviewStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return {
    store: new IndexedDbOverviewStore(db),
    seedRawOverview: (raw: unknown) =>
      promisifyRequest(
        db.transaction(OVERVIEWS_STORE, "readwrite").objectStore(OVERVIEWS_STORE).put(raw as object),
      ).then(() => undefined),
  };
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

test("a field a newer client wrote onto the state survives this client toggling read", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const overviewId = OverviewId.parse(randomUUID());
  await promisifyRequest(
    db
      .transaction(OVERVIEW_STATES_STORE, "readwrite")
      .objectStore(OVERVIEW_STATES_STORE)
      .put({ overviewId, read: false, favourite: false, userTags: [], lastPlayedAt: "2026-02-01T10:00:00.000Z" }),
  );

  await new IndexedDbOverviewStore(db).setOverviewState(overviewId, { read: true });

  const stored = await promisifyRequest<Record<string, unknown>>(
    db.transaction(OVERVIEW_STATES_STORE, "readonly").objectStore(OVERVIEW_STATES_STORE).get(overviewId),
  );
  assert.equal(stored.lastPlayedAt, "2026-02-01T10:00:00.000Z");
  assert.equal(stored.read, true);
});

test("a field a newer client wrote onto the overview survives this client filing it", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);
  const raw = await promisifyRequest<Record<string, unknown>>(
    db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE).get(overview.id),
  );
  await promisifyRequest(
    db
      .transaction(OVERVIEWS_STORE, "readwrite")
      .objectStore(OVERVIEWS_STORE)
      .put({ ...raw, rating: 4 }),
  );

  await store.setOverviewTopics(overview.id, [TopicId.parse(randomUUID())]);

  const stored = await promisifyRequest<Record<string, unknown>>(
    db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE).get(overview.id),
  );
  assert.equal(stored.rating, 4);
});

test("an overview is written with the current schema version on it, and read back without one", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  await store.saveOverview(overview);

  const stored = await promisifyRequest<Record<string, unknown>>(
    db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE).get(overview.id),
  );

  assert.equal(stored.schemaVersion, CURRENT_OVERVIEW_SCHEMA_VERSION);
  assert.deepEqual(await store.getOverview(overview.id), overview);
});
