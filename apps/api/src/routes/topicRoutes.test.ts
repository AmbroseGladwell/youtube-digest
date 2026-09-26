import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { storedTopic } from "../testing/storedRecords.testHelper.js";

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
