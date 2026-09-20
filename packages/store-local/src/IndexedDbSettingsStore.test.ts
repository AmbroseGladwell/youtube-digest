import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { defineSettingsStoreConformanceSuite } from "@overview/store-conformance";
import { DEFAULT_SETTINGS, Settings } from "@overview/types";
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
