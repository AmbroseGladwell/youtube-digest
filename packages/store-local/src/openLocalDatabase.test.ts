import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  DATABASE_NAME,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  SETTINGS_KEY,
  SETTINGS_STORE,
  TOPICS_STORE,
} from "./localDatabaseSchema.js";
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
