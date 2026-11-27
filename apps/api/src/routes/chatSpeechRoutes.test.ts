import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chatRecordId, chatUsageAllowances, ChatSpeechEvent, type ChatMessage } from "@overview/domain";
import { appendChatMessages } from "../chats/appendChatMessages.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { createTestApp, type TestApp, type TestAppOptions } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const AT = "2026-09-26T09:00:00.000Z";
const ANSWER = "Take 1.5 litres a day. It helps most in the heat. Drink before you're thirsty. Salt matters too. So does sleep.";

const exchange: ChatMessage[] = [
  { from: "reader", text: "How much water?", at: AT },
  { from: "answer", text: ANSWER, at: AT, citations: [], inSource: true },
];

const answerFor = async (testApp: TestApp, account: TestAccount) => {
  const overview = storedOverview();
  assert.equal((await account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  const conversationId = randomUUID();
  await appendChatMessages(
    new RecordsRepository(testApp.sql, () => testApp.clock.now),
    account.accountId,
    { owner: { kind: "overview", id: overview.id }, conversationId, messages: exchange },
    testApp.clock.now,
  );
  return chatRecordId(overview.id, conversationId);
};

const setUp = async (t: test.TestContext, options: TestAppOptions = { dollarsPerMachineHour: 3.6 }) => {
  const testApp = await createTestApp({}, options);
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const chatId = await answerFor(testApp, account);
  const speak = (index = 1, id = chatId) => account.inject({ method: "POST", url: `/api/chat-records/${id}/messages/${index}/speech` });
  return { testApp, account, chatId, speak };
};

const eventsOf = (payload: string): ChatSpeechEvent[] =>
  payload
    .trim()
    .split("\n")
    .map((line) => ChatSpeechEvent.parse(JSON.parse(line)));

test("an answer is read aloud from what the server stored: its sentences first, then chunks by length, the first at least 3 s of speech", async (t) => {
  const { testApp, speak } = await setUp(t);

  const response = await speak();

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["content-type"]), /application\/x-ndjson/);
  const events = eventsOf(response.payload);
  assert.deepEqual(
    events.map((event) => (event.type === "audio" || event.type === "skipped" ? [event.type, event.first, event.count] : [event.type])),
    [["sentences"], ["audio", 0, 3], ["audio", 3, 2], ["done"]],
  );
  const [sentences] = events;
  assert.equal(sentences?.type === "sentences" && sentences.sentences.length, 5);
  assert.deepEqual(
    testApp.narrator.requests.map((request) => request.lines),
    [
      ["Take 1 point 5 litres a day.", "It helps most in the heat.", "Drink before you're thirsty."],
      ["Salt matters too.", "So does sleep."],
    ],
  );
});

test("a play spends chat usage by the machine time it took, a cold start and the idle after it, and records it as a speech cost", async (t) => {
  const { testApp, account, speak } = await setUp(t);

  await speak();

  const usage = (await account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { share: number; used: number };
  assert.equal(usage.used, 0);
  assert.equal(usage.share, 17_000 / chatUsageAllowances.free);
  const costs = await testApp.sql.query<{ area: string; detail: string; quantity: string }>(
    "select area, detail, quantity::text from account_costs where account_id = $1",
    [account.accountId],
  );
  assert.deepEqual(costs, [{ area: "speech", detail: "chat", quantity: "17" }]);
});

test("with no hourly price set, an answer still plays and spends nothing", async (t) => {
  const { testApp, account, speak } = await setUp(t, {});

  assert.equal((await speak()).statusCode, 200);

  const usage = (await account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { share: number };
  assert.equal(usage.share, 0);
  assert.deepEqual(await testApp.sql.query("select 1 from account_costs"), []);
});

test("a reader whose month of chat is spent is refused before anything is spoken", async (t) => {
  const { testApp, account, speak } = await setUp(t);
  await testApp.sql.query("insert into chat_usage (day, account_id, units) values ($1::date, $2, $3)", [
    AT.slice(0, 10),
    account.accountId,
    chatUsageAllowances.free,
  ]);

  const response = await speak();

  assert.equal(response.statusCode, 429);
  assert.equal((response.json() as { error: { details: { quota: string } } }).error.details.quota, "chat-month");
  assert.deepEqual(testApp.narrator.requests, []);
});

test("only an answer in one of the reader's own chats can be read aloud", async (t) => {
  const { testApp, chatId, speak } = await setUp(t);
  const stranger = await makeAccount(testApp);

  assert.equal((await speak(0)).statusCode, 404);
  assert.equal((await speak(2)).statusCode, 404);
  assert.equal((await stranger.inject({ method: "POST", url: `/api/chat-records/${chatId}/messages/1/speech` })).statusCode, 404);
  assert.deepEqual(testApp.narrator.requests, []);
});

test("a chunk that fails is skipped for the reader and the rest still plays", async (t) => {
  const { testApp, speak } = await setUp(t);
  testApp.narrator.failNext("TTS answered 503");

  const events = eventsOf((await speak()).payload);

  assert.deepEqual(
    events.map((event) => event.type),
    ["sentences", "skipped", "audio", "done"],
  );
});

test("a warm-up starts the voice once while it is still running, and is our cost, not the reader's usage", async (t) => {
  const { testApp, account } = await setUp(t);

  assert.equal((await account.inject({ method: "POST", url: "/api/speech/warm" })).statusCode, 204);
  assert.equal((await account.inject({ method: "POST", url: "/api/speech/warm" })).statusCode, 204);

  assert.equal(testApp.narrator.warms, 1);
  const usage = (await account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { share: number };
  assert.equal(usage.share, 0);
  const costs = await testApp.sql.query<{ detail: string }>("select detail from account_costs");
  assert.deepEqual(costs, [{ detail: "chat-warm" }]);
});

test("without a voice the server says read aloud is unavailable", async (t) => {
  const { speak } = await setUp(t, { narration: false });

  assert.equal((await speak()).statusCode, 503);
});

test("with Modal in front, a play runs there and is charged at Modal's price under its own detail", async (t) => {
  const { testApp, account, speak } = await setUp(t, { dollarsPerMachineHour: 3.6, modalSpeech: { dollarsPerHour: 7.2 } });

  assert.equal((await speak()).statusCode, 200);

  assert.equal(testApp.narrator.requests.length, 0);
  assert.equal(testApp.modalNarrator.requests.length, 2);
  const costs = await testApp.sql.query<{ detail: string; quantity: string; dollars: string }>(
    "select detail, quantity::text, round(dollars::numeric, 3)::text as dollars from account_costs where account_id = $1",
    [account.accountId],
  );
  assert.deepEqual(costs, [{ detail: "chat-modal", quantity: "5", dollars: "0.010" }]);
});

test("when Modal fails before a line, the play falls back to the Fly pool and is charged there", async (t) => {
  const { testApp, account, speak } = await setUp(t, { dollarsPerMachineHour: 3.6, modalSpeech: { dollarsPerHour: 7.2 } });
  testApp.modalNarrator.failNext("TTS answered 502");

  const events = eventsOf((await speak()).payload);

  assert.deepEqual(
    events.map((event) => event.type),
    ["sentences", "audio", "audio", "done"],
  );
  assert.equal(testApp.narrator.requests.length, 1);
  const details = await testApp.sql.query<{ detail: string }>("select detail from account_costs where account_id = $1 order by detail", [
    account.accountId,
  ]);
  assert.deepEqual(
    details.map(({ detail }) => detail),
    ["chat", "chat-modal"],
  );
});
