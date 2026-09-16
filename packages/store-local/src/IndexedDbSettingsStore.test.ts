import { IDBFactory } from "fake-indexeddb";
import { defineSettingsStoreConformanceSuite } from "@overview/store-conformance";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { openLocalDatabase } from "./openLocalDatabase.js";

defineSettingsStoreConformanceSuite("IndexedDbSettingsStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return new IndexedDbSettingsStore(db);
});
