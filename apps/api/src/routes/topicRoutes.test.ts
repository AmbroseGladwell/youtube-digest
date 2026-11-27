import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TopicId } from "@overview/domain";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import type { DuplicateTopicFold } from "../records/foldDuplicateTopics.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { letInOverview, makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview, storedTopic, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

test("creating a topic answers 201 and the feed carries it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const topic = storedTopic({ name: "cooking" });

  const response = await account.inject({ method: "POST", url: "/api/topics", body: topic });

  assert.equal(response.statusCode, 201);
  assert.equal((await account.change("topic", topic.id)).body!.name, "cooking");
  await testApp.close();
});

test("a topic is created once; posting it again is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const topic = storedTopic();
  await account.inject({ method: "POST", url: "/api/topics", body: topic });

  const response = await account.inject({ method: "POST", url: "/api/topics", body: topic });

  assert.equal(response.statusCode, 409);
  await testApp.close();
});

test("a topic that fails the schema is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/topics",
    body: { ...storedTopic(), createdAt: "yesterday" },
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

const seedTopic = async (account: TestAccount, overrides: Parameters<typeof storedTopic>[0] = {}): Promise<string> => {
  const { schemaVersion, updatedAt: _updatedAt, ...body } = storedTopic(overrides);
  await account.seedRaw("topic", body.id, schemaVersion, body);
  return body.id;
};

const seedFiled = async (account: TestAccount, topicIds: string[]): Promise<string> => {
  const { schemaVersion, updatedAt: _updatedAt, ...body } = storedOverview({ topicIds: topicIds.map((id) => TopicId.parse(id)) });
  await account.seedRaw("overview", body.id, schemaVersion, body);
  return body.id;
};

const liveTopicIds = async (account: TestAccount): Promise<string[]> =>
  (await account.changes()).changes.filter((change) => change.kind === "topic" && !change.deleted).map((change) => change.id);

const topicIdsOf = async (account: TestAccount, overviewId: string): Promise<unknown> =>
  (await account.change("overview", overviewId)).body!.topicIds;

test("a topic posted with a live topic's name folds into the earlier one, re-filing its overviews", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const earlier = await seedTopic(account, { name: "Fatherhood", createdAt: "2026-11-01T08:00:00.000Z" });
  const kept = await seedFiled(account, [earlier]);
  const later = storedTopic({ name: " fatherhood ", createdAt: "2026-11-20T08:00:00.000Z" });
  await account.inject({ method: "POST", url: "/api/topics", body: later });
  const moved = await seedFiled(account, [later.id]);

  const refiled = await account.inject({
    method: "PUT",
    url: `/api/overviews/${moved}/topics`,
    body: { topicIds: [later.id], updatedAt: UPDATED_AT },
  });

  assert.equal(refiled.statusCode, 200);
  assert.deepEqual(await liveTopicIds(account), [earlier]);
  assert.deepEqual(await topicIdsOf(account, kept), [earlier]);
  assert.deepEqual(await topicIdsOf(account, moved), [earlier]);
  assert.deepEqual((await account.change("settings", "settings")).body!.topicAliases, { [later.id]: earlier });
  await testApp.close();
});

test("an overview filed under a topic before it was folded lands on the kept topic", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const earlier = await seedTopic(account, { name: "Cooking", createdAt: "2026-11-01T08:00:00.000Z" });
  const later = await seedTopic(account, { name: "cooking", createdAt: "2026-11-02T08:00:00.000Z" });
  const both = await seedFiled(account, [earlier, later]);
  const onlyLater = await seedFiled(account, [later]);

  await account.inject({ method: "POST", url: "/api/topics", body: storedTopic({ name: "Travel" }) });

  assert.deepEqual(await topicIdsOf(account, both), [earlier]);
  assert.deepEqual(await topicIdsOf(account, onlyLater), [earlier]);
  await testApp.close();
});

test("a fold keeps the later topic's description when the kept one has none", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const earlier = await seedTopic(account, { name: "Psychology", createdAt: "2026-11-01T08:00:00.000Z" });
  await account.inject({
    method: "POST",
    url: "/api/topics",
    body: storedTopic({ name: "psychology", description: "How people think and feel.", createdAt: "2026-11-02T08:00:00.000Z" }),
  });

  assert.equal((await account.change("topic", earlier)).body!.description, "How people think and feel.");
  await testApp.close();
});

test("renaming a topic changes its name everywhere", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = await seedTopic(account, { name: "Fatherhod" });

  const response = await account.inject({ method: "PUT", url: `/api/topics/${id}`, body: { name: "Fatherhood", updatedAt: UPDATED_AT } });

  assert.equal(response.statusCode, 200);
  assert.equal((await account.change("topic", id)).body!.name, "Fatherhood");
  await testApp.close();
});

test("renaming a topic onto a name in use merges it into the earlier topic", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const parenting = await seedTopic(account, { name: "Parenting", createdAt: "2026-11-01T08:00:00.000Z" });
  const fatherhood = await seedTopic(account, { name: "Fatherhood", createdAt: "2026-11-02T08:00:00.000Z" });
  const filed = await seedFiled(account, [fatherhood]);

  await account.inject({ method: "PUT", url: `/api/topics/${fatherhood}`, body: { name: "parenting", updatedAt: UPDATED_AT } });

  assert.deepEqual(await liveTopicIds(account), [parenting]);
  assert.deepEqual(await topicIdsOf(account, filed), [parenting]);
  await testApp.close();
});

test("a rename to a blank name is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = await seedTopic(account);

  const response = await account.inject({ method: "PUT", url: `/api/topics/${id}`, body: { name: "  ", updatedAt: UPDATED_AT } });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("merging files every overview under the kept topic once, and a late filing follows it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const from = await seedTopic(account, { name: "Fatherhood" });
  const into = await seedTopic(account, { name: "Parenting" });
  const both = await seedFiled(account, [into, from]);
  const onlyFrom = await seedFiled(account, [from]);
  const late = await seedFiled(account, []);

  const response = await account.inject({ method: "POST", url: `/api/topics/${from}/merge`, body: { into, updatedAt: UPDATED_AT } });
  await account.inject({ method: "PUT", url: `/api/overviews/${late}/topics`, body: { topicIds: [from], updatedAt: UPDATED_AT } });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(await liveTopicIds(account), [into]);
  assert.deepEqual(await topicIdsOf(account, both), [into]);
  assert.deepEqual(await topicIdsOf(account, onlyFrom), [into]);
  assert.deepEqual(await topicIdsOf(account, late), [into]);
  await testApp.close();
});

test("merging into a topic that doesn't exist is not found, and changes nothing", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const from = await seedTopic(account);

  const response = await account.inject({
    method: "POST",
    url: `/api/topics/${from}/merge`,
    body: { into: randomUUID(), updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(await liveTopicIds(account), [from]);
  await testApp.close();
});

test("deleting a topic unfiles its overviews, and an overview pushed later under it is unfiled too", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const kept = await seedTopic(account, { name: "Health" });
  const gone = await seedTopic(account, { name: "Fatherhood" });
  const filed = await seedFiled(account, [kept, gone]);
  const pushedLater = storedOverview({ topicIds: [TopicId.parse(gone)] });

  const response = await account.inject({ method: "DELETE", url: `/api/topics/${gone}` });
  await letInOverview(testApp, account.accountId, pushedLater);
  await account.inject({ method: "POST", url: "/api/overviews", body: pushedLater });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(await liveTopicIds(account), [kept]);
  assert.deepEqual(await topicIdsOf(account, filed), [kept]);
  assert.deepEqual(await topicIdsOf(account, pushedLater.id), []);
  await testApp.close();
});

test("deleting a topic twice is fine", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = await seedTopic(account);
  await account.inject({ method: "DELETE", url: `/api/topics/${id}` });

  const settingsBefore = await account.change("settings", "settings");

  const response = await account.inject({ method: "DELETE", url: `/api/topics/${id}` });

  assert.equal(response.statusCode, 204);
  assert.equal((await account.change("settings", "settings")).seq, settingsBefore.seq);
  await testApp.close();
});

test("the migration folds an account's existing same-name topics and leaves other accounts alone", async () => {
  const testApp = await createTestApp({}, { migrationsUpTo: 50 });
  const account = await makeAccount(testApp);
  const other = await makeAccount(testApp);
  const fatherhoods = [
    await seedTopic(account, { name: "Fatherhood", createdAt: "2026-11-03T08:00:00.000Z" }),
    await seedTopic(account, { name: "Fatherhood", createdAt: "2026-11-01T08:00:00.000Z" }),
    await seedTopic(account, { name: "Fatherhood", createdAt: "2026-11-02T08:00:00.000Z" }),
  ];
  const filed = [await seedFiled(account, [fatherhoods[0]!]), await seedFiled(account, [fatherhoods[2]!])];
  const otherTopic = await seedTopic(other, { name: "Fatherhood" });
  const folds: DuplicateTopicFold[] = [];

  await runMigrations(testApp.sql, { before: migrationSteps({ topics: (folded) => folds.push(...folded) }) });

  assert.deepEqual(await liveTopicIds(account), [fatherhoods[1]]);
  for (const id of filed) {
    assert.deepEqual(await topicIdsOf(account, id), [fatherhoods[1]]);
  }
  assert.deepEqual(await liveTopicIds(other), [otherTopic]);
  assert.deepEqual(
    folds.map(({ kept, folded, refiled }) => ({ kept, folded: [...folded].sort(), refiled })),
    [{ kept: fatherhoods[1], folded: [fatherhoods[0]!, fatherhoods[2]!].sort(), refiled: 2 }],
  );
  await testApp.close();
});
