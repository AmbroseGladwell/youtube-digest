import { IDBFactory } from "fake-indexeddb";
import { defineTranscriptStoreConformanceSuite } from "@overview/store-conformance";
import { IndexedDbTranscriptStore } from "./IndexedDbTranscriptStore.js";
import { openLocalDatabase } from "./openLocalDatabase.js";

defineTranscriptStoreConformanceSuite("IndexedDbTranscriptStore", async () => {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  return new IndexedDbTranscriptStore(db);
});
