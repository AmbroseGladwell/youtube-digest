import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { makeOverview } from "@overview/store-conformance";
import { DATABASE_NAME } from "./localDatabaseSchema.js";
import { localDatabaseName } from "./localDatabaseName.js";
import { openLocalLibrary } from "./openLocalLibrary.js";

const ACCOUNT_A = "0b6f3c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const ACCOUNT_B = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

test("the no-account library keeps the name every install already has", () => {
  assert.equal(localDatabaseName(null), DATABASE_NAME);
});

test("each account's library is a database of its own, named for the account", () => {
  assert.equal(localDatabaseName(ACCOUNT_A), `overview-account-${ACCOUNT_A}`);
  assert.notEqual(localDatabaseName(ACCOUNT_A), localDatabaseName(ACCOUNT_B));
});

test("two accounts and the no-account library on one device never see each other's overviews", async () => {
  const indexedDB = new IDBFactory();
  const noAccount = await openLocalLibrary({ accountId: null, indexedDB });
  const a = await openLocalLibrary({ accountId: ACCOUNT_A, indexedDB });
  const b = await openLocalLibrary({ accountId: ACCOUNT_B, indexedDB });
  const fromA = makeOverview();
  const fromNoAccount = makeOverview();

  await a.overviewStore.saveOverview(fromA);
  await noAccount.overviewStore.saveOverview(fromNoAccount);

  assert.deepEqual((await a.overviewStore.listOverviews()).map(({ id }) => id), [fromA.id]);
  assert.deepEqual(await b.overviewStore.listOverviews(), []);
  assert.deepEqual((await noAccount.overviewStore.listOverviews()).map(({ id }) => id), [fromNoAccount.id]);
});

test("an account's library is still there when it is opened again after closing", async () => {
  const indexedDB = new IDBFactory();
  const first = await openLocalLibrary({ accountId: ACCOUNT_A, indexedDB });
  const overview = makeOverview();
  await first.overviewStore.saveOverview(overview);
  first.close();

  const again = await openLocalLibrary({ accountId: ACCOUNT_A, indexedDB });

  assert.deepEqual((await again.overviewStore.listOverviews()).map(({ id }) => id), [overview.id]);
});
