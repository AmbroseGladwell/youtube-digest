import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { makeOverview, makeProject } from "@overview/store-conformance";
import {
  CURRENT_SCHEMA_VERSIONS,
  OverviewId,
  suggestedQuestionId,
  type RecordChange,
  type SuggestedQuestion,
  type SuggestedQuestionScope,
} from "@overview/domain";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore.js";
import { IndexedDbSuggestedQuestionStore } from "./IndexedDbSuggestedQuestionStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { openEnrolledDatabase, openTestDatabase, readRecordOutbox } from "./enrolledDatabase.testHelper.js";

const LIBRARY: SuggestedQuestionScope = { kind: "library" };
const AT = "2026-11-23T10:00:00.000Z";
const LATER = "2026-11-23T11:00:00.000Z";

const question = (scope: SuggestedQuestionScope, overviewIds: [string, string], madeAt: string): SuggestedQuestion => ({
  id: suggestedQuestionId(scope, overviewIds, randomUUID()),
  scope,
  overviewIds: [OverviewId.parse(overviewIds[0]), OverviewId.parse(overviewIds[1])],
  text: "Does the second one's routine survive the first one's warning?",
  madeAt,
  shownAt: null,
  askedAt: null,
  dismissedAt: null,
  feedback: null,
});

const pulled = (record: SuggestedQuestion, seq: number): RecordChange => {
  const { id, ...body } = record;
  return {
    kind: "suggestedQuestion",
    id,
    schemaVersion: CURRENT_SCHEMA_VERSIONS.suggestedQuestion,
    rev: 1,
    seq,
    updatedAt: record.madeAt,
    deleted: false,
    body,
  };
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

const pair = (): [string, string] => [randomUUID(), randomUUID()];

test("questions pulled from the server are listed by scope, newest first, and only while live", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbSuggestedQuestionStore(db);
  const projectId = randomUUID();
  const project: SuggestedQuestionScope = { kind: "project", projectId: projectId as never };
  const older = question(LIBRARY, pair(), AT);
  const newer = question(LIBRARY, pair(), LATER);
  const dismissed = { ...question(LIBRARY, pair(), LATER), dismissedAt: LATER };
  const obvious = { ...question(LIBRARY, pair(), LATER), feedback: { verdict: "obvious" as const, at: LATER } };
  const asked = { ...question(LIBRARY, pair(), AT), askedAt: LATER, feedback: { verdict: "glad" as const, at: LATER } };
  const inProject = question(project, pair(), AT);
  const elsewhere = question({ kind: "project", projectId: randomUUID() as never }, pair(), AT);

  await new IndexedDbSyncStorage(db).applyChanges(
    [older, newer, dismissed, obvious, asked, inProject, elsewhere].map((record, index) => pulled(record, index + 1)),
    7,
  );

  assert.deepEqual((await store.listSuggestedQuestions(LIBRARY)).map(({ id }) => id).sort(), [older.id, newer.id, asked.id].sort());
  assert.equal((await store.listSuggestedQuestions(LIBRARY))[0]?.id, newer.id);
  assert.deepEqual(
    (await store.listSuggestedQuestions(project)).map(({ id }) => id),
    [inProject.id],
  );
  assert.deepEqual(await store.getSuggestedQuestion(dismissed.id), dismissed);
  assert.equal(await store.getSuggestedQuestion(suggestedQuestionId(LIBRARY, pair(), randomUUID())), null);
});

test("a change merges here and journals one update; one that changes nothing, or a question not here, journals nothing", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbSuggestedQuestionStore(db, { onJournaled: () => (journaled += 1) });
  const record = question(LIBRARY, pair(), AT);
  await new IndexedDbSyncStorage(db).applyChanges([pulled(record, 1)], 1);

  await store.changeSuggestedQuestion(record.id, { shownAt: LATER });
  await store.changeSuggestedQuestion(record.id, { shownAt: "2026-11-23T12:00:00.000Z" });
  await store.changeSuggestedQuestion(suggestedQuestionId(LIBRARY, pair(), randomUUID()), { shownAt: AT });

  assert.equal((await store.getSuggestedQuestion(record.id))?.shownAt, LATER);
  assert.deepEqual(
    (await readRecordOutbox(db)).map(({ kind, id, change }) => ({ kind, id, change })),
    [{ kind: "suggestedQuestion", id: record.id, change: { op: "suggestedQuestion", change: { shownAt: LATER } } }],
  );
  assert.equal(journaled, 1);
});

test("feedback merges by its time, so glad then obvious takes it out of the list", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbSuggestedQuestionStore(db);
  const record = question(LIBRARY, pair(), AT);
  await new IndexedDbSyncStorage(db).applyChanges([pulled(record, 1)], 1);

  await store.changeSuggestedQuestion(record.id, { feedback: { verdict: "glad", at: AT } });
  await store.changeSuggestedQuestion(record.id, { feedback: { verdict: "obvious", at: LATER } });

  assert.deepEqual((await store.getSuggestedQuestion(record.id))?.feedback, { verdict: "obvious", at: LATER });
  assert.deepEqual(await store.listSuggestedQuestions(LIBRARY), []);
});

test("a change made here stays on top when the server sends the question again before it is pushed", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbSuggestedQuestionStore(db);
  const record = question(LIBRARY, pair(), AT);
  await storage.applyChanges([pulled(record, 1)], 1);
  await store.changeSuggestedQuestion(record.id, { dismissedAt: LATER });

  await storage.applyChanges([pulled(record, 2)], 2);

  assert.equal((await store.getSuggestedQuestion(record.id))?.dismissedAt, LATER);
});

test("questions go with either of their overviews, deleted here or pulled as a tombstone, without journaling", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbSuggestedQuestionStore(db);
  const overviews = new IndexedDbOverviewStore(db);
  const [deletedHere, deletedThere, kept, other] = [makeOverview(), makeOverview(), makeOverview(), makeOverview()];
  for (const overview of [deletedHere, deletedThere, kept, other]) {
    await overviews.saveOverview(overview);
  }
  const here = question(LIBRARY, [kept.id, deletedHere.id], AT);
  const there = question(LIBRARY, [deletedThere.id, kept.id], AT);
  const survivor = question(LIBRARY, [kept.id, other.id], AT);
  await storage.applyChanges([pulled(here, 1), pulled(there, 2), pulled(survivor, 3)], 3);

  await overviews.deleteOverview(deletedHere.id);
  await storage.applyChanges([gone("overview", deletedThere.id, 4)], 4);

  assert.deepEqual(
    (await store.listSuggestedQuestions(LIBRARY)).map(({ id }) => id),
    [survivor.id],
  );
  assert.ok(!(await readRecordOutbox(db)).some((entry) => entry.kind === "suggestedQuestion"));
});

test("a project's questions go with it, deleted here or pulled as a tombstone, and the library's stay", async () => {
  const db = await openEnrolledDatabase();
  const storage = new IndexedDbSyncStorage(db);
  const store = new IndexedDbSuggestedQuestionStore(db);
  const projects = new IndexedDbProjectStore(db);
  const [deletedHere, deletedThere] = [makeProject(), makeProject()];
  for (const project of [deletedHere, deletedThere]) {
    await projects.createProject(project);
  }
  const scopeOf = (projectId: string): SuggestedQuestionScope => ({ kind: "project", projectId: projectId as never });
  const ids = pair();
  const [here, there, library] = [
    question(scopeOf(deletedHere.id), ids, AT),
    question(scopeOf(deletedThere.id), ids, AT),
    question(LIBRARY, ids, AT),
  ];
  await storage.applyChanges([pulled(here, 1), pulled(there, 2), pulled(library, 3)], 3);

  await projects.deleteProject(deletedHere.id);
  await storage.applyChanges([gone("project", deletedThere.id, 4)], 4);

  assert.deepEqual(await store.listSuggestedQuestions(scopeOf(deletedHere.id)), []);
  assert.deepEqual(await store.listSuggestedQuestions(scopeOf(deletedThere.id)), []);
  assert.deepEqual(
    (await store.listSuggestedQuestions(LIBRARY)).map(({ id }) => id),
    [library.id],
  );
  assert.ok(!(await readRecordOutbox(db)).some((entry) => entry.kind === "suggestedQuestion"));
});
