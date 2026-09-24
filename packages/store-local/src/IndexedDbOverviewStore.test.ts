import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { defineOverviewStoreConformanceSuite, makeOverview } from "@overview/store-conformance";
import { CURRENT_OVERVIEW_SCHEMA_VERSION, OverviewId, OverviewState, TopicId } from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { OVERVIEWS_STORE, OVERVIEW_STATES_STORE, TOPICS_STORE } from "./localDatabaseSchema.js";
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

const dated = async (write: () => Promise<unknown>, read: () => Promise<Record<string, unknown>>) => {
  const before = new Date().toISOString();
  await write();
  const after = new Date().toISOString();
  const { updatedAt } = await read();

  assert.equal(typeof updatedAt, "string");
  assert.ok(
    (updatedAt as string) >= before && (updatedAt as string) <= after,
    `${String(updatedAt)} is not the time of the write it was stamped by`,
  );
  return updatedAt as string;
};

test("an overview is written with the time it was written at on it, and read back without one", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  const readRaw = () =>
    promisifyRequest<Record<string, unknown>>(
      db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE).get(overview.id),
    );

  await dated(() => store.saveOverview(overview), readRaw);

  assert.deepEqual(await store.getOverview(overview.id), overview);
});

test("filing an overview under a topic dates that write, not the one that created it", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  const overview = makeOverview();
  const readRaw = () =>
    promisifyRequest<Record<string, unknown>>(
      db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE).get(overview.id),
    );

  await store.saveOverview(overview);
  const created = (await readRaw()).updatedAt as string;
  const filed = await dated(
    () => store.setOverviewTopics(overview.id, [TopicId.parse(randomUUID())]),
    readRaw,
  );

  assert.ok(filed >= created, "filing left the overview dated by an earlier write");
});

test("marking an overview read dates the state record it wrote", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  const overviewId = OverviewId.parse(randomUUID());

  await dated(
    () => store.setOverviewState(overviewId, { read: true }),
    () =>
      promisifyRequest<Record<string, unknown>>(
        db
          .transaction(OVERVIEW_STATES_STORE, "readonly")
          .objectStore(OVERVIEW_STATES_STORE)
          .get(overviewId),
      ),
  );

  assert.deepEqual(await store.getOverviewState(overviewId), {
    overviewId,
    read: true,
    favourite: false,
    userTags: [],
  });
});

test("a topic is written dated, and read back without the stamp", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbOverviewStore(db);
  let topicId = "";

  await dated(
    async () => {
      topicId = (await store.createTopic({ name: "Finance" })).id;
    },
    () =>
      promisifyRequest<Record<string, unknown>>(
        db.transaction(TOPICS_STORE, "readonly").objectStore(TOPICS_STORE).get(topicId),
      ),
  );

  assert.deepEqual(Object.keys((await store.listTopics())[0]!).sort(), [
    "createdAt",
    "description",
    "id",
    "name",
  ]);
});
