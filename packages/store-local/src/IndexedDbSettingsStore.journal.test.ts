import assert from "node:assert/strict";
import test from "node:test";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { SETTINGS_KEY, SETTINGS_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, readOutbox, readRaw } from "./enrolledDatabase.testHelper.js";

test("updating settings in an enrolled library journals the patch as given, dated by the write", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbSettingsStore(db, { onJournaled: () => (journaled += 1) });

  await store.update({ readerContext: "A product engineer." });

  const [entry] = await readOutbox(db);
  assert.equal(journaled, 1);
  assert.equal(entry?.kind, "settings");
  assert.equal(entry?.id, SETTINGS_KEY);
  assert.deepEqual(entry?.change, { op: "settings", patch: { readerContext: "A product engineer." } });
  assert.equal(entry?.updatedAt, (await readRaw(db, SETTINGS_STORE, SETTINGS_KEY)).updatedAt);
});

test("updating settings in a library that was never enrolled journals nothing", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbSettingsStore(db);

  await store.update({ readerContext: "A product engineer." });

  assert.deepEqual(await readOutbox(db), []);
});
