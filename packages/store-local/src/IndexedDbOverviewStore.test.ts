import { IDBFactory } from "fake-indexeddb";
import { defineOverviewStoreConformanceSuite } from "@overview/store-conformance";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { openLocalDatabase } from "./openLocalDatabase.js";

defineOverviewStoreConformanceSuite("IndexedDbOverviewStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return new IndexedDbOverviewStore(db);
});
