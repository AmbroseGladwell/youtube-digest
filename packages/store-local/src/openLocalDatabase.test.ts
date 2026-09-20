import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  SETTINGS_KEY,
  SETTINGS_STORE,
  TOPICS_STORE,
  TRANSCRIPTS_STORE,
} from "./localDatabaseSchema.js";
import { LocalDatabaseBlockedError } from "./LocalDatabaseBlockedError.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";

function openVersionOneDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(OVERVIEWS_STORE, { keyPath: "id" });
      db.createObjectStore(TOPICS_STORE, { keyPath: "id" });
      db.createObjectStore(OVERVIEW_STATES_STORE, { keyPath: "overviewId" });
      db.createObjectStore(SETTINGS_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openVersionTwoDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(OVERVIEWS_STORE, { keyPath: "id" });
      db.createObjectStore(TOPICS_STORE, { keyPath: "id" });
      db.createObjectStore(OVERVIEW_STATES_STORE, { keyPath: "overviewId" });
      db.createObjectStore(SETTINGS_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(db: IDBDatabase, store: string) {
  return promisifyRequest<unknown[]>(db.transaction(store, "readonly").objectStore(store).getAll());
}

function put(db: IDBDatabase, store: string, value: unknown, key?: string) {
  const objectStore = db.transaction(store, "readwrite").objectStore(store);
  return promisifyRequest(key === undefined ? objectStore.put(value) : objectStore.put(value, key));
}

test("opening a database written before the novelty rename drops the stored overviews", async () => {
  const indexedDB = new IDBFactory();
  const before = await openVersionOneDatabase(indexedDB);
  await put(before, OVERVIEWS_STORE, {
    id: "overview-1",
    verdict: { novelty: "competent_not_new", dubious: false, reasoning: "x", similarTo: [] },
  });
  await put(before, OVERVIEW_STATES_STORE, { overviewId: "overview-1", read: true, favourite: true });
  before.close();

  const after = await openLocalDatabase({ indexedDB });

  assert.deepEqual(await getAll(after, OVERVIEWS_STORE), []);
  assert.deepEqual(await getAll(after, OVERVIEW_STATES_STORE), []);
});

test("the reset keeps topics and settings", async () => {
  const indexedDB = new IDBFactory();
  const before = await openVersionOneDatabase(indexedDB);
  await put(before, TOPICS_STORE, { id: "topic-1", name: "Fitness", description: null, createdAt: "2026-09-01" });
  await put(before, SETTINGS_STORE, { anthropicApiKey: "sk-test" }, SETTINGS_KEY);
  before.close();

  const after = await openLocalDatabase({ indexedDB });

  assert.equal((await getAll(after, TOPICS_STORE)).length, 1);
  assert.deepEqual(
    await promisifyRequest(
      after.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
    ),
    { anthropicApiKey: "sk-test" },
  );
});

test("adding the transcripts store keeps the overviews a reader already has", async () => {
  const indexedDB = new IDBFactory();
  const before = await openVersionTwoDatabase(indexedDB);
  await put(before, OVERVIEWS_STORE, { id: "overview-1", coreClaim: "A claim worth keeping." });
  await put(before, OVERVIEW_STATES_STORE, { overviewId: "overview-1", read: true, favourite: true });
  before.close();

  const after = await openLocalDatabase({ indexedDB });

  assert.equal((await getAll(after, OVERVIEWS_STORE)).length, 1);
  assert.equal((await getAll(after, OVERVIEW_STATES_STORE)).length, 1);
  assert.deepEqual(await getAll(after, TRANSCRIPTS_STORE), []);
});

function openNextVersion(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION + 1);
    request.onupgradeneeded = () => undefined;
    request.onblocked = () => reject(new Error("the upgrade was blocked"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test("an open that an older connection blocks rejects rather than never settling", async () => {
  const indexedDB = new IDBFactory();
  const holding = await openVersionTwoDatabase(indexedDB);

  await assert.rejects(() => openLocalDatabase({ indexedDB }), LocalDatabaseBlockedError);

  holding.close();
});

test("an open connection closes itself so another context's upgrade is not blocked", async () => {
  const indexedDB = new IDBFactory();
  await openLocalDatabase({ indexedDB });

  const upgraded = await openNextVersion(indexedDB);

  assert.equal(upgraded.version, DATABASE_VERSION + 1);
});

test("a connection that closed for another context's upgrade says so, rather than failing silently later", async () => {
  const indexedDB = new IDBFactory();
  let superseded = false;
  await openLocalDatabase({ indexedDB, onSuperseded: () => (superseded = true) });

  await openNextVersion(indexedDB);

  assert.equal(superseded, true);
});
