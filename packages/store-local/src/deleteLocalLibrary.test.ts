import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { makeOverview } from "@overview/store-conformance";
import { deleteLocalLibrary } from "./deleteLocalLibrary.js";
import { openLocalLibrary } from "./openLocalLibrary.js";

const ACCOUNT = "0b6f3c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

const databaseNames = async (indexedDB: IDBFactory) => (await indexedDB.databases()).map(({ name }) => name).sort();

test("a closed account library is removed from the device, and the no-account one is left alone", async () => {
  const indexedDB = new IDBFactory();
  const noAccount = await openLocalLibrary({ accountId: null, indexedDB });
  const account = await openLocalLibrary({ accountId: ACCOUNT, indexedDB });
  await account.overviewStore.saveOverview(makeOverview());
  await noAccount.overviewStore.saveOverview(makeOverview());
  account.close();

  await deleteLocalLibrary({ accountId: ACCOUNT, indexedDB });

  assert.deepEqual(await databaseNames(indexedDB), ["overview-local-store"]);
  assert.equal((await noAccount.overviewStore.listOverviews()).length, 1);
  const reopened = await openLocalLibrary({ accountId: ACCOUNT, indexedDB });
  assert.deepEqual(await reopened.overviewStore.listOverviews(), []);
});

test("deleting a library the device never had is nothing to do", async () => {
  const indexedDB = new IDBFactory();
  await deleteLocalLibrary({ accountId: ACCOUNT, indexedDB });
  assert.deepEqual(await databaseNames(indexedDB), []);
});
