import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview } from "@overview/store-conformance";
import { IDBFactory } from "fake-indexeddb";
import { chatRecordId, CURRENT_SCHEMA_VERSIONS, OverviewId, ProjectId, type Chat, type RecordChange } from "@overview/domain";
import { IndexedDbChatStore } from "./IndexedDbChatStore.js";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore.js";
import { CHATS_BY_OVERVIEW_INDEX, CHATS_BY_PROJECT_INDEX, CHATS_STORE, DATABASE_NAME } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { openEnrolledDatabase, openTestDatabase, putRaw, readRecordOutbox } from "./enrolledDatabase.testHelper.js";

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
    (await store.listChats({ kind: "overview", id: overviewId })).map(({ id }) => id),
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
  for (const overview of [deletedHere, deletedThere, kept]) {
    await overviews.saveOverview(overview);
  }
  const [here, there, other] = [deletedHere, deletedThere, kept].map((overview) => chat(overview.id, "2026-11-15T10:00:00.000Z"));
  await storage.applyChanges([pulled(here!, 1), pulled(there!, 2), pulled(other!, 3)], 3);

  await overviews.deleteOverview(deletedHere.id);
  await storage.applyChanges([gone("overview", deletedThere.id, 4)], 4);

  assert.deepEqual(await store.listChats({ kind: "overview", id: deletedHere.id }), []);
  assert.deepEqual(await store.listChats({ kind: "overview", id: deletedThere.id }), []);
  assert.deepEqual(
    (await store.listChats({ kind: "overview", id: kept.id })).map(({ id }) => id),
    [other!.id],
  );
  assert.ok(!(await readRecordOutbox(db)).some((entry) => entry.kind === "chat"));
});

const owned = (owner: { projectId?: string }, startedAt: string): Chat => {
  const conversation = randomUUID();
  const { overviewId: _overviewId, ...rest } = chat(randomUUID(), startedAt);
  return owner.projectId === undefined
    ? { ...rest, id: chatRecordId({ kind: "library" }, conversation) }
    : { ...rest, id: chatRecordId({ kind: "project", id: owner.projectId }, conversation), projectId: ProjectId.parse(owner.projectId) };
};

test("a project's chats are listed by the project, the library's are those with no owner (OV-353), and every chat is listed oldest first (OV-363)", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbChatStore(db);
  const projectId = randomUUID();
  const project = owned({ projectId }, "2026-11-20T10:00:00.000Z");
  const library = owned({}, "2026-11-20T09:00:00.000Z");
  const about = chat(randomUUID(), "2026-11-20T08:00:00.000Z");

  await new IndexedDbSyncStorage(db).applyChanges([pulled(project, 1), pulled(library, 2), pulled(about, 3)], 3);

  assert.deepEqual(
    (await store.listChats({ kind: "project", id: projectId })).map(({ id }) => id),
    [project.id],
  );
  assert.deepEqual(
    (await store.listChats({ kind: "library" })).map(({ id }) => id),
    [library.id],
  );
  assert.equal(library.id.startsWith("library:"), true);
  assert.deepEqual(
    (await store.listEveryChat()).map(({ id }) => id),
    [about.id, library.id, project.id],
  );
});

test("a project's chats go with it, whether it is deleted here or its tombstone is pulled", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbChatStore(db);
  const [here, there] = [ProjectId.parse(randomUUID()), ProjectId.parse(randomUUID())];
  const library = owned({}, "2026-11-20T09:00:00.000Z");
  await storage.applyChanges(
    [
      pulled(owned({ projectId: here }, "2026-11-20T10:00:00.000Z"), 1),
      pulled(owned({ projectId: there }, "2026-11-20T10:00:00.000Z"), 2),
      pulled(library, 3),
    ],
    3,
  );

  await new IndexedDbProjectStore(db).deleteProject(here);
  await storage.applyChanges([gone("project", there, 4)], 4);

  assert.deepEqual(await store.listChats({ kind: "project", id: here }), []);
  assert.deepEqual(await store.listChats({ kind: "project", id: there }), []);
  assert.deepEqual(
    (await store.listChats({ kind: "library" })).map(({ id }) => id),
    [library.id],
  );
});

test("a library opened from before project chats keeps its chats and gains the project index", async () => {
  const indexedDB = new IDBFactory();
  const before = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 7);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(CHATS_STORE, { keyPath: "id" }).createIndex(CHATS_BY_OVERVIEW_INDEX, "overviewId");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const kept = chat(randomUUID(), "2026-11-15T10:00:00.000Z");
  await putRaw(before, CHATS_STORE, { ...kept, schemaVersion: 3 });
  before.close();

  const db = await openLocalDatabase({ indexedDB });

  assert.deepEqual(
    (await new IndexedDbChatStore(db).listChats({ kind: "overview", id: kept.overviewId! })).map(({ id }) => id),
    [kept.id],
  );
  assert.ok(db.transaction(CHATS_STORE).objectStore(CHATS_STORE).indexNames.contains(CHATS_BY_PROJECT_INDEX));
});
