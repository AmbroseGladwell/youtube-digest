import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview } from "@overview/store-conformance";
import { chatRecordId, CURRENT_SCHEMA_VERSIONS, OverviewId, type Chat, type RecordChange } from "@overview/domain";
import { IndexedDbChatStore } from "./IndexedDbChatStore.js";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { openEnrolledDatabase, openTestDatabase, readRecordOutbox } from "./enrolledDatabase.testHelper.js";

const chat = (overviewId: string, startedAt: string): Chat => {
  const id = chatRecordId(overviewId, randomUUID());
  return {
    id,
    overviewId: OverviewId.parse(overviewId),
    startedAt,
    messages: [
      { from: "reader", text: "How much creatine?", at: startedAt },
      {
        from: "answer",
        text: "Three to five grams a day.",
        at: startedAt,
        citations: [{ startMs: 61_000, endMs: 70_000 }],
        inSource: true,
      },
    ],
  };
};

const pulled = (record: Chat, seq: number): RecordChange => {
  const { id, ...body } = record;
  return { kind: "chat", id, schemaVersion: CURRENT_SCHEMA_VERSIONS.chat, rev: 1, seq, updatedAt: record.startedAt, deleted: false, body };
};

const gone = (kind: RecordChange["kind"], id: string, seq: number): RecordChange => ({
  kind,
  id,
  schemaVersion: CURRENT_SCHEMA_VERSIONS[kind],
  rev: 2,
  seq,
  updatedAt: null,
  deleted: true,
});

test("chats pulled from the server are listed by their overview, oldest first, and read one by one", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbChatStore(db);
  const overviewId = randomUUID();
  const later = chat(overviewId, "2026-11-15T10:05:00.000Z");
  const earlier = chat(overviewId, "2026-11-15T10:00:00.000Z");
  const elsewhere = chat(randomUUID(), "2026-11-15T09:00:00.000Z");

  await new IndexedDbSyncStorage(db).applyChanges([pulled(later, 1), pulled(earlier, 2), pulled(elsewhere, 3)], 3);

  assert.deepEqual(
    (await store.listChats(OverviewId.parse(overviewId))).map(({ id }) => id),
    [earlier.id, later.id],
  );
  assert.deepEqual(await store.getChat(later.id), later);
  assert.equal(await store.getChat(chatRecordId(overviewId, randomUUID())), null);
});

test("deleting a chat in an enrolled library journals one delete, and says so; a chat not here journals nothing", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbChatStore(db, { onJournaled: () => (journaled += 1) });
  const record = chat(randomUUID(), "2026-11-15T10:00:00.000Z");
  await new IndexedDbSyncStorage(db).applyChanges([pulled(record, 1)], 1);

  await store.deleteChat(record.id);
  await store.deleteChat(record.id);

  assert.equal(await store.getChat(record.id), null);
  assert.deepEqual(
    (await readRecordOutbox(db)).map(({ kind, id, change }) => ({ kind, id, op: change.op })),
    [{ kind: "chat", id: record.id, op: "delete" }],
  );
  assert.equal(journaled, 1);
});

test("a chat deleted here stays gone when the server sends it again before the delete is pushed", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbChatStore(db);
  const record = chat(randomUUID(), "2026-11-15T10:00:00.000Z");
  await storage.applyChanges([pulled(record, 1)], 1);
  await store.deleteChat(record.id);

  await storage.applyChanges([pulled(record, 2)], 2);

  assert.equal(await store.getChat(record.id), null);
});

test("an overview's chats go with it, whether it is deleted here or its tombstone is pulled", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbChatStore(db);
  const overviews = new IndexedDbOverviewStore(db);
  const [deletedHere, deletedThere, kept] = [makeOverview(), makeOverview(), makeOverview()];
  for (const overview of [deletedHere, deletedThere, kept]) await overviews.saveOverview(overview);
  const [here, there, other] = [deletedHere, deletedThere, kept].map((overview) => chat(overview.id, "2026-11-15T10:00:00.000Z"));
  await storage.applyChanges([pulled(here!, 1), pulled(there!, 2), pulled(other!, 3)], 3);

  await overviews.deleteOverview(deletedHere.id);
  await storage.applyChanges([gone("overview", deletedThere.id, 4)], 4);

  assert.deepEqual(await store.listChats(deletedHere.id), []);
  assert.deepEqual(await store.listChats(deletedThere.id), []);
  assert.deepEqual(
    (await store.listChats(kept.id)).map(({ id }) => id),
    [other!.id],
  );
  assert.ok(!(await readRecordOutbox(db)).some((entry) => entry.kind === "chat"));
});
