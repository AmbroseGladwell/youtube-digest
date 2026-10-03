import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { makeOverview } from "@overview/store-conformance";
import { adoptLibraryIntoAccount } from "./adoptLibraryIntoAccount.js";
import { openLocalLibrary } from "./openLocalLibrary.js";

const ACCOUNT = "0b6f3c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

// What an install signed in before this card holds: an enrolled library with a write still
// waiting to go, a cursor, a revision the server gave, and its settings.
async function signedInBeforeAccounts(indexedDB: IDBFactory) {
  const legacy = await openLocalLibrary({ accountId: null, indexedDB });
  const overview = makeOverview();
  await legacy.overviewStore.saveOverview(overview);
  await legacy.syncStorage.enrol();
  await legacy.overviewStore.setOverviewState(overview.id, { read: true });
  await legacy.settingsStore.update({ showMilestoneCards: false });
  await legacy.syncStorage.applyChanges([], 7);
  legacy.close();
  return overview;
}

test("an install signed in before accounts had libraries keeps everything under that account", async () => {
  const indexedDB = new IDBFactory();
  const overview = await signedInBeforeAccounts(indexedDB);

  await adoptLibraryIntoAccount({ accountId: ACCOUNT, indexedDB });

  const account = await openLocalLibrary({ accountId: ACCOUNT, indexedDB });
  assert.deepEqual((await account.overviewStore.listOverviews()).map(({ id }) => id), [overview.id]);
  assert.equal((await account.overviewStore.getOverviewState(overview.id)).read, true);
  assert.equal(await account.syncStorage.isEnrolled(), true);
  assert.equal(await account.syncStorage.cursor(), 7);
  assert.ok((await account.syncStorage.listPending()).some((entry) => entry.change.op === "state"));
  assert.equal((await account.settingsStore.get()).showMilestoneCards, false);
});

test("the no-account library starts empty and unenrolled", async () => {
  const indexedDB = new IDBFactory();
  await signedInBeforeAccounts(indexedDB);

  await adoptLibraryIntoAccount({ accountId: ACCOUNT, indexedDB });

  const left = await openLocalLibrary({ accountId: null, indexedDB });
  assert.deepEqual(await left.overviewStore.listOverviews(), []);
  assert.equal(await left.syncStorage.isEnrolled(), false);
  assert.deepEqual(await left.syncStorage.listPending(), []);
});

test("running it again changes nothing, so a run that stopped can simply be repeated", async () => {
  const indexedDB = new IDBFactory();
  const overview = await signedInBeforeAccounts(indexedDB);
  await adoptLibraryIntoAccount({ accountId: ACCOUNT, indexedDB });
  const pendingBefore = await (await openLocalLibrary({ accountId: ACCOUNT, indexedDB })).syncStorage.listPending();

  await adoptLibraryIntoAccount({ accountId: ACCOUNT, indexedDB });

  const account = await openLocalLibrary({ accountId: ACCOUNT, indexedDB });
  assert.deepEqual((await account.overviewStore.listOverviews()).map(({ id }) => id), [overview.id]);
  assert.deepEqual(await account.syncStorage.listPending(), pendingBefore);
});

test("a write after adopting is journalled after the ones that came with it", async () => {
  const indexedDB = new IDBFactory();
  const overview = await signedInBeforeAccounts(indexedDB);
  await adoptLibraryIntoAccount({ accountId: ACCOUNT, indexedDB });
  const account = await openLocalLibrary({ accountId: ACCOUNT, indexedDB });
  const carried = await account.syncStorage.listPending();

  await account.overviewStore.setOverviewState(overview.id, { favourite: true });

  const pending = await account.syncStorage.listPending();
  assert.equal(pending.length, carried.length + 1);
  assert.ok(pending.at(-1)!.key > Math.max(...carried.map(({ key }) => key)));
});
