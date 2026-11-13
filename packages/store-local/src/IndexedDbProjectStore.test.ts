import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { defineProjectStoreConformanceSuite, makeOverview, makeProject } from "@overview/store-conformance";
import { CURRENT_PROJECT_SCHEMA_VERSION, OverviewId, projectMemberId } from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore.js";
import { PROJECTS_STORE, PROJECT_MEMBERS_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, putRaw, readRaw, readRecordOutbox } from "./enrolledDatabase.testHelper.js";

defineProjectStoreConformanceSuite("IndexedDbProjectStore", async () => new IndexedDbProjectStore(await openTestDatabase()));

const pending = async (db: IDBDatabase) => (await readRecordOutbox(db)).map(({ kind, id, change }) => ({ kind, id, op: change.op }));

test("making a project in an enrolled library journals the stored record, and says so once", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbProjectStore(db, { onJournaled: () => (journaled += 1) });
  const project = makeProject();

  await store.createProject(project);
  await store.createProject(project);

  const stored = await readRaw(db, PROJECTS_STORE, project.id);
  assert.equal(stored.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.deepEqual(
    (await readRecordOutbox(db)).map(({ kind, id, change }) => ({ kind, id, change })),
    [{ kind: "project", id: project.id, change: { op: "replace", record: stored } }],
  );
  assert.equal(journaled, 1);
});

test("changing a project journals only the fields that changed", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbProjectStore(db);
  const project = makeProject();
  await store.createProject(project);

  await store.updateProject(project.id, { archivedAt: "2026-11-12T10:00:00.000Z" });

  const [, update] = await readRecordOutbox(db);
  assert.deepEqual(update?.change, { op: "project", patch: { archivedAt: "2026-11-12T10:00:00.000Z" } });
});

test("a project's fields this client does not know survive a change to it", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbProjectStore(db);
  const project = makeProject();
  await putRaw(db, PROJECTS_STORE, { ...project, colour: "teal", schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION });

  await store.updateProject(project.id, { name: "Kitchen" });

  assert.equal((await readRaw(db, PROJECTS_STORE, project.id)).colour, "teal");
});

test("adding and removing an overview journal each change to its membership record, with no list on either side", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbProjectStore(db);
  const project = makeProject();
  const overviewId = OverviewId.parse(randomUUID());
  await store.createProject(project);

  await store.addToProject(project.id, overviewId);
  await store.removeFromProject(project.id, overviewId);

  const id = projectMemberId(project.id, overviewId);
  const entries = (await readRecordOutbox(db)).slice(1);
  assert.deepEqual(
    entries.map(({ kind, id: entryId, change }) => ({ kind, id: entryId, op: change.op })),
    [
      { kind: "projectMember", id, op: "member" },
      { kind: "projectMember", id, op: "member" },
    ],
  );
  const [added, removed] = entries.map(({ change }) => (change.op === "member" ? change.change : {}));
  assert.deepEqual(added?.addedBy, { by: "reader" });
  assert.ok(typeof removed?.removedAt === "string" && removed.removedAt > String(added?.addedAt));
  assert.equal((await readRaw(db, PROJECT_MEMBERS_STORE, id)).removedAt, removed?.removedAt);
});

test("deleting a project journals one delete and takes its membership records off this device without journaling them", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbProjectStore(db);
  const project = makeProject();
  const overviewId = OverviewId.parse(randomUUID());
  await store.createProject(project);
  await store.addToProject(project.id, overviewId);

  await store.deleteProject(project.id);
  await store.deleteProject(project.id);

  assert.deepEqual((await pending(db)).slice(2), [{ kind: "project", id: project.id, op: "delete" }]);
  assert.equal(await readRaw(db, PROJECT_MEMBERS_STORE, projectMemberId(project.id, overviewId)), undefined);
});

test("deleting an overview takes it out of every project on this device", async () => {
  const db = await openTestDatabase();
  const projects = new IndexedDbProjectStore(db);
  const overviews = new IndexedDbOverviewStore(db);
  const [first, second] = [makeProject(), makeProject({ name: "Launching my app" })];
  const [doomed, kept] = [makeOverview(), makeOverview()];
  await overviews.saveOverview(doomed);
  await overviews.saveOverview(kept);
  for (const project of [first, second]) {
    await projects.createProject(project);
    await projects.addToProject(project.id, doomed.id);
  }
  await projects.addToProject(first.id, kept.id);

  await overviews.deleteOverview(doomed.id);

  assert.deepEqual(
    (await projects.listMembers()).map(({ overviewId }) => overviewId),
    [kept.id],
  );
});
