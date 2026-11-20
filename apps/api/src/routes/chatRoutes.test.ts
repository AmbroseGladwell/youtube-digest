import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chatRecordId, CLIENT_SCHEMA_VERSIONS, MAX_CHAT_QUESTIONS, type ChatMessage } from "@overview/domain";
import { appendChatMessages } from "../chats/appendChatMessages.js";
import { isApiError } from "../http/ApiError.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const AT = "2026-09-26T09:00:00.000Z";

const exchange = (question: string): ChatMessage[] => [
  { from: "reader", text: question, at: AT },
  { from: "answer", text: `About ${question}.`, at: AT, citations: [{ startMs: 61_000, endMs: 120_000 }], inSource: true },
];

async function withOverview(account: TestAccount) {
  const overview = storedOverview();
  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  assert.equal(response.statusCode, 201);
  return overview;
}

function chatting(testApp: TestApp, account: TestAccount) {
  const records = new RecordsRepository(testApp.sql, () => testApp.clock.now);
  return (overviewId: string, conversationId: string, messages: ChatMessage[]) =>
    appendChatMessages(
      records,
      account.accountId,
      { owner: { kind: "overview", id: overviewId }, conversationId, messages },
      testApp.clock.now,
    );
}

const refusal = async (attempt: Promise<unknown>): Promise<string> => {
  try {
    await attempt;
  } catch (error) {
    if (isApiError(error)) return error.code;
    throw error;
  }
  throw new Error("the write was not refused");
};

test("the server starts a conversation with its first exchange, appends the next, and the feed carries one chat at its latest", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  const append = chatting(testApp, account);
  const conversation = randomUUID();

  await append(overview.id, conversation, exchange("creatine"));
  testApp.clock.advance(60_000);
  const second = await append(overview.id, conversation, exchange("dose"));

  const id = chatRecordId(overview.id, conversation);
  const change = await account.change("chat", id);
  assert.equal(change.rev, second.rev);
  assert.equal(second.rev, 2);
  const body = change.body as { overviewId: string; startedAt: string; messages: ChatMessage[] };
  assert.equal(body.overviewId, overview.id);
  assert.equal(body.startedAt, AT);
  assert.deepEqual(
    body.messages.map((message) => message.text),
    ["creatine", "About creatine.", "dose", "About dose."],
  );
});

test("a chat is never started for an overview the account doesn't hold, or one it deleted", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const append = chatting(testApp, account);
  const overview = await withOverview(account);
  assert.equal((await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` })).statusCode, 200);

  assert.equal(await refusal(append(randomUUID(), randomUUID(), exchange("anything"))), "not_found");
  assert.equal(await refusal(append(overview.id, randomUUID(), exchange("anything"))), "not_found");
});

test("a conversation the reader deleted takes no more messages, and deleting it again is already done", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  const append = chatting(testApp, account);
  const conversation = randomUUID();
  await append(overview.id, conversation, exchange("creatine"));

  const deleted = await account.inject({ method: "DELETE", url: `/api/chats/${overview.id}/${conversation}` });
  const again = await account.inject({ method: "DELETE", url: `/api/chats/${overview.id}/${conversation}` });

  assert.equal(deleted.statusCode, 200);
  assert.equal(again.statusCode, 204);
  assert.equal((await account.change("chat", chatRecordId(overview.id, conversation))).deleted, true);
  assert.equal(await refusal(append(overview.id, conversation, exchange("dose"))), "not_found");
});

test("a conversation past its length is refused whole, leaving what was said", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  const append = chatting(testApp, account);
  const conversation = randomUUID();
  for (let question = 0; question < MAX_CHAT_QUESTIONS; question += 1) {
    await append(overview.id, conversation, exchange(`question ${question}`));
  }

  assert.equal(await refusal(append(overview.id, conversation, exchange("one more"))), "invalid_request");
  const body = (await account.change("chat", chatRecordId(overview.id, conversation))).body as { messages: unknown[] };
  assert.equal(body.messages.length, MAX_CHAT_QUESTIONS * 2);
});

test("deleting an overview tombstones its chats and leaves another overview's", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const [doomed, kept] = [await withOverview(account), await withOverview(account)];
  const append = chatting(testApp, account);
  const [first, second, other] = [randomUUID(), randomUUID(), randomUUID()];
  await append(doomed.id, first, exchange("one"));
  await append(doomed.id, second, exchange("two"));
  await append(kept.id, other, exchange("three"));

  assert.equal((await account.inject({ method: "DELETE", url: `/api/overviews/${doomed.id}` })).statusCode, 200);

  assert.equal((await account.change("chat", chatRecordId(doomed.id, first))).deleted, true);
  assert.equal((await account.change("chat", chatRecordId(doomed.id, second))).deleted, true);
  assert.equal((await account.change("chat", chatRecordId(kept.id, other))).deleted, false);
});

test("an overview made again under its own id keeps its chats", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  const append = chatting(testApp, account);
  const conversation = randomUUID();
  await append(overview.id, conversation, exchange("creatine"));

  const regenerated = await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { ...overview, coreClaim: "Said again, differently." },
    ifMatch: 1,
  });

  assert.equal(regenerated.statusCode, 200);
  const chat = await account.change("chat", chatRecordId(overview.id, conversation));
  assert.equal(chat.deleted, false);
  assert.equal((chat.body as { messages: unknown[] }).messages.length, 2);
});

test("a client built before chats is never sent one", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  await chatting(testApp, account)(overview.id, randomUUID(), exchange("creatine"));

  const beforeChats = CLIENT_SCHEMA_VERSIONS.find(({ schemaVersions }) => schemaVersions.chat > 0)!.clientVersion - 1;
  const response = await account.inject({ method: "GET", url: "/api/changes?since=0&limit=200", clientVersion: beforeChats });

  const kinds = (response.json() as { changes: Array<{ kind: string }> }).changes.map((change) => change.kind);
  assert.ok(kinds.includes("overview"));
  assert.ok(!kinds.includes("chat"));
});

test("a question's pins and set-aside overviews must be overview and project ids, a few at a time", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const overview = await withOverview(account);
  const ask = (extra: Record<string, unknown>) =>
    account.inject({
      method: "POST",
      url: `/api/chats/${overview.id}/messages`,
      body: { conversationId: randomUUID(), text: "Hi?", ...extra },
    });

  for (const extra of [
    { pins: { overviews: ["not-an-id"] } },
    { pins: { projects: [7] } },
    { setAside: ["not-an-id"] },
    { pins: { overviews: Array.from({ length: 21 }, () => randomUUID()) } },
  ]) {
    assert.equal((await ask(extra)).statusCode, 400, JSON.stringify(extra));
  }
});
