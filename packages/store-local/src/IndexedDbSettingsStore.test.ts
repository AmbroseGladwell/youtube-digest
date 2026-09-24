import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { defineSettingsStoreConformanceSuite } from "@overview/store-conformance";
import { DEFAULT_SETTINGS, Settings, UnreadableRecordError } from "@overview/domain";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { SETTINGS_KEY, SETTINGS_STORE } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";

defineSettingsStoreConformanceSuite("IndexedDbSettingsStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return new IndexedDbSettingsStore(db);
});

async function storeHoldingSettings(stored: unknown): Promise<IndexedDbSettingsStore> {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  await promisifyRequest(
    db.transaction(SETTINGS_STORE, "readwrite").objectStore(SETTINGS_STORE).put(stored, SETTINGS_KEY),
  );
  return new IndexedDbSettingsStore(db);
}

test("get() fills in a field the stored settings predate, rather than handing back undefined", async () => {
  const store = await storeHoldingSettings({
    sectionsEnabled: DEFAULT_SETTINGS.sectionsEnabled,
    readerContext: "I'm a beginner cook.",
    model: DEFAULT_SETTINGS.model,
  });

  const settings = await store.get();

  assert.equal(settings.plan, DEFAULT_SETTINGS.plan);
  assert.equal(settings.plusNoticeDismissed, DEFAULT_SETTINGS.plusNoticeDismissed);
  assert.doesNotThrow(() => Settings.parse(settings));
});

test("get() keeps what the stored settings do say, it does not reset them to the defaults", async () => {
  const store = await storeHoldingSettings({
    sectionsEnabled: { verdict: false, selling: true, howToApply: true, watchAnyway: true },
    readerContext: "I'm a beginner cook.",
    model: DEFAULT_SETTINGS.model,
  });

  const settings = await store.get();

  assert.equal(settings.readerContext, "I'm a beginner cook.");
  assert.equal(settings.sectionsEnabled.verdict, false);
});

test("a toggle a newer client added to sectionsEnabled survives this client changing another one", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  await promisifyRequest(
    db
      .transaction(SETTINGS_STORE, "readwrite")
      .objectStore(SETTINGS_STORE)
      .put({ ...DEFAULT_SETTINGS, sectionsEnabled: { ...DEFAULT_SETTINGS.sectionsEnabled, chapters: false } }, SETTINGS_KEY),
  );
  const store = new IndexedDbSettingsStore(db);

  await store.update({
    sectionsEnabled: { verdict: false, selling: true, howToApply: true, watchAnyway: true },
  });

  const stored = await promisifyRequest<Record<string, Record<string, unknown>>>(
    db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
  );
  assert.equal(stored.sectionsEnabled?.chapters, false);
  assert.equal(stored.sectionsEnabled?.verdict, false);
});

test("a setting a newer client added survives this client changing another one", async () => {
  const store = await storeHoldingSettings({ ...DEFAULT_SETTINGS, theme: "dark" });

  await store.update({ readerContext: "I'm a beginner cook." });

  assert.equal((await store.unreadable()), null);
});

test("settings written by a newer client are reported rather than silently reset", async () => {
  const store = await storeHoldingSettings({ ...DEFAULT_SETTINGS, schemaVersion: 99 });

  assert.deepEqual(await store.get(), DEFAULT_SETTINGS);
  const unreadable = await store.unreadable();
  assert.equal(unreadable?.reason, "future-version");
  assert.equal(unreadable?.kind, "settings");
});

test("an unreadable settings record is never written over", async () => {
  const store = await storeHoldingSettings({ ...DEFAULT_SETTINGS, schemaVersion: 99, readerContext: "theirs" });

  await assert.rejects(() => store.update({ readerContext: "mine" }), UnreadableRecordError);
});

test("an update dates the settings it wrote, and get() hands back settings with no stamp on them", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const store = new IndexedDbSettingsStore(db);

  const before = new Date().toISOString();
  await store.update({ readerContext: "A product engineer." });
  const after = new Date().toISOString();

  const stored = await promisifyRequest<Record<string, unknown>>(
    db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
  );
  assert.ok(
    typeof stored.updatedAt === "string" && stored.updatedAt >= before && stored.updatedAt <= after,
    `${String(stored.updatedAt)} is not the time of the write it was stamped by`,
  );
  assert.deepEqual(await store.get(), { ...DEFAULT_SETTINGS, readerContext: "A product engineer." });
});
