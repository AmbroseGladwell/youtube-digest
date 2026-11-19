import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import {
  answeredFromOverview,
  chatRecordId,
  MAX_CHAT_QUESTIONS,
  VideoId,
  youTubeSource,
  type ChatMessage,
  type Overview,
  type WebSource,
  type ChatStreamEvent,
} from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { ChatAnswerer } from "./ChatAnswerer.js";
import { makeFakeChatOpenAi, type FakeChatAnswer, type FakeChatOpenAi } from "./FakeChatOpenAi.testHelper.js";

const SEGMENTS = [
  { text: "Creatine is a backup store of energy.", startMs: 0, endMs: 8_000 },
  { text: "Take three to five grams a day.", startMs: 61_000, endMs: 70_000 },
];

const answer = (
  text: string,
  passages: string[] = ["p2"],
  chatMessages: string[] = [],
  inSource = true,
  overviewParts: string[] = [],
  generalKnowledge = false,
) => ({
  reply: { answer: text, passages, overviewParts, chatMessages, inSource, generalKnowledge },
});

interface Setup {
  testApp: TestApp;
  account: TestAccount;
  openAi: FakeChatOpenAi;
  overviewId: string;
  waits: number[];
  ask(conversationId: string, text: string, overviewId?: string): ReturnType<TestAccount["inject"]>;
}

async function setUp(
  t: TestContext,
  answers: FakeChatAnswer[],
  {
    dailyChatMessages = 20_000,
    transcript = true,
    logger,
  }: { dailyChatMessages?: number; transcript?: boolean; logger?: FastifyBaseLogger } = {},
): Promise<Setup> {
  const openAi = makeFakeChatOpenAi(...answers);
  const waits: number[] = [];
  const testApp = await createTestApp(
    {},
    {
      ourKey: {
        apiKey: "sk-test-ours",
        dailyGenerations: 300,
        signedOutDailyGenerations: 50,
        dailyChatMessages,
        http: openAi.http,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
      ...(logger === undefined ? {} : { logger }),
    },
  );
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const stored = makeStoredTranscript({ videoId: VideoId.parse(randomUUID().slice(0, 11)), segments: SEGMENTS });
  const overview = storedOverview({ source: youTubeSource(stored.video!) });
  assert.equal((await account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  if (transcript) {
    assert.equal((await account.inject({ method: "PUT", url: `/api/transcripts/${stored.videoId}`, body: stored })).statusCode, 204);
  }
  return {
    testApp,
    account,
    openAi,
    overviewId: overview.id,
    waits,
    ask: (conversationId, text, overviewId = overview.id) =>
      account.inject({ method: "POST", url: `/api/chats/${overviewId}/messages`, body: { conversationId, text } }),
  };
}

const eventsOf = (body: string): ChatStreamEvent[] =>
  body
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => JSON.parse(block.slice("data: ".length)) as ChatStreamEvent);

const answered = (body: string) => {
  const last = eventsOf(body).at(-1);
  assert.equal(last?.type, "answered", body);
  return last as Extract<ChatStreamEvent, { type: "answered" }>;
};

const usedThisMonth = async (setup: Setup) =>
  ((await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { used: number }).used;

test("a question is answered as a stream on Luna, cited by time from code, stored with the question, and counted", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams a day.")]);
  const conversation = randomUUID();

  const response = await setup.ask(conversation, "How much creatine?");

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["content-type"]), /^text\/event-stream/);
  const events = eventsOf(response.body);
  assert.ok(events.filter((event) => event.type === "text").length > 1, "the answer arrives in pieces");
  assert.equal(events.flatMap((event) => (event.type === "text" ? [event.text] : [])).join(""), "Three to five grams a day.");
  const done = answered(response.body);
  const stored = await setup.account.change("chat", chatRecordId(setup.overviewId, conversation));
  assert.equal(stored.rev, done.rev);
  assert.deepEqual((stored.body as { messages: ChatMessage[] }).messages, done.messages);
  assert.deepEqual(done.messages[1], {
    from: "answer",
    text: "Three to five grams a day.",
    at: setup.testApp.clock.now.toISOString(),
    citations: [{ startMs: 61_000, endMs: 70_000 }],
    inSource: true,
  });

  const [request] = setup.openAi.requests;
  assert.equal(request?.model, "gpt-6-luna");
  assert.equal(request?.stream, true);
  assert.equal(request?.cacheKey, `chat-${setup.overviewId}`);
  assert.match(request?.messages[0]?.content ?? "", /\[p2 1:01\] Take three to five grams a day\./);
  assert.deepEqual(request?.messages.at(-1), { role: "user", content: "How much creatine?" });
  assert.deepEqual((await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json(), {
    plan: "free",
    resetsOn: "2026-10-01",
    used: 1,
    limit: 100,
  });
  const [cost] = await setup.testApp.sql.query<{ area: string; detail: string; calls: number }>(
    "select area, detail, calls from account_costs where account_id = $1 and area = 'chat'",
    [setup.account.accountId],
  );
  assert.deepEqual({ ...cost }, { area: "chat", detail: "message", calls: 1 });
});

test("the reader's profile goes last in the system message, as generation reads it, and only items they've been shown", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("Three to five grams a day.")], { logger });
  const at = "2026-09-01T09:00:00.000Z";
  const learned = (text: string, noticedAt: string | null) => ({
    [text.toLowerCase()]: { text, source: "From 3 overviews on sleep", learnedAt: at, noticedAt, removedAt: null },
  });
  const settings = await setup.account.inject({
    method: "PUT",
    url: "/api/settings",
    body: {
      aboutYou: { who: ["dad"], time: [], focus: ["sleep"] },
      learned: { ...learned("Training for a marathon", at), ...learned("Learning Rust", null) },
      updatedAt: at,
    },
  });
  assert.equal(settings.statusCode, 200, settings.body);

  answered((await setup.ask(randomUUID(), "How much creatine?")).body);

  const system = setup.openAi.requests[0]?.messages[0]?.content ?? "";
  assert.equal(setup.openAi.requests[0]?.messages[0]?.role, "system");
  const reader = system.slice(system.indexOf("# The reader"));
  assert.ok(system.indexOf("# The transcript") < system.indexOf("# The reader"), "the transcript stays ahead of the profile");
  assert.ok(reader.includes("I'm a dad, and right now I'm focusing on sleep. Also: Training for a marathon."), reader);
  assert.ok(!system.includes("Rust"), "an item the reader hasn't been shown is never sent");
  assert.equal(lines.find((line) => line.logCode === "api.chat.answered")?.personalised, true);
});

test("with nothing known about the reader, chat sends no profile and logs it as not personalised", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("Three to five grams a day.")], { logger });

  answered((await setup.ask(randomUUID(), "How much creatine?")).body);

  assert.ok(!(setup.openAi.requests[0]?.messages[0]?.content ?? "").includes("# The reader"));
  assert.equal(lines.find((line) => line.logCode === "api.chat.answered")?.personalised, false);
});

test("a follow-up carries its conversation, another chat can be built on and cited, and a deleted one is never sent", async (t) => {
  const setup = await setUp(t, [
    answer("Take it after training."),
    answer("As you decided, after training.", [], ["c1.m2"]),
    answer("Three to five grams."),
    answer("Not covered.", [], [], false),
  ]);
  const [first, second, third] = [randomUUID(), randomUUID(), randomUUID()];
  answered((await setup.ask(first, "When should I take it?")).body);

  const built = answered((await setup.ask(second, "Remind me when I decided to take it?")).body);
  assert.deepEqual(built.messages[1], {
    from: "answer",
    text: "As you decided, after training.",
    at: setup.testApp.clock.now.toISOString(),
    citations: [{ chatId: chatRecordId(setup.overviewId, first), message: 1 }],
    inSource: false,
  });
  assert.equal(setup.openAi.requests[1]?.messages[1]?.role, "user", "a second system message would break the transcript's cache");
  assert.match(setup.openAi.requests[1]?.messages[1]?.content ?? "", /\[c1\.m2 answer\] Take it after training\./);

  answered((await setup.ask(second, "And how much?")).body);
  assert.deepEqual(setup.openAi.requests[2]?.messages.slice(-3), [
    { role: "user", content: "Remind me when I decided to take it?" },
    { role: "assistant", content: "As you decided, after training." },
    { role: "user", content: "And how much?" },
  ]);

  assert.equal((await setup.account.inject({ method: "DELETE", url: `/api/chats/${setup.overviewId}/${first}` })).statusCode, 200);
  answered((await setup.ask(third, "Is it vegan?")).body);
  const prompt = setup.openAi.requests[3]?.messages.map((message) => message.content).join("\n") ?? "";
  assert.ok(!prompt.includes("Take it after training."), "the deleted conversation stays out");
  assert.ok(prompt.includes("And how much?"), "the live one goes in");
});

test("a question the transcript doesn't answer is declined, with no citation of the source", async (t) => {
  const setup = await setUp(t, [answer("The video doesn't cover that.", ["p1"], [], false)]);

  const done = answered((await setup.ask(randomUUID(), "Is it vegan?")).body);

  assert.deepEqual(done.messages[1], {
    from: "answer",
    text: "The video doesn't cover that.",
    at: setup.testApp.clock.now.toISOString(),
    citations: [],
    inSource: false,
  });
});

test("a fair question the source doesn't cover is answered from general knowledge, stored as not from the source, and logged as such", async (t) => {
  const { lines, logger } = recordingLogger();
  const general = "The video doesn't cover it. Creatine is usually made by fermentation, so most of it is vegan.";
  const setup = await setUp(t, [answer(general, ["p1"], [], false, [], true), answer("The video doesn't say.", [], [], false)], {
    logger,
  });

  const done = answered((await setup.ask(randomUUID(), "Is it vegan?")).body);
  answered((await setup.ask(randomUUID(), "Where does it mention chickens?")).body);

  assert.match(setup.openAi.requests[0]?.messages[0]?.content ?? "", /answer briefly from general knowledge/);
  assert.deepEqual(done.messages[1], {
    from: "answer",
    text: general,
    at: setup.testApp.clock.now.toISOString(),
    citations: [],
    inSource: false,
  });
  assert.deepEqual(
    lines.filter((line) => line.logCode === "api.chat.answered").map((line) => [line.inSource, line.generalKnowledge]),
    [
      [false, true],
      [false, false],
    ],
  );
});

test("a question about the overview itself is answered from its items, cited by place in code, and not counted as the source", async (t) => {
  const setup = await setUp(t, [answer("The overview's second key point says so.", [], [], false, ["kp2", "kp9"])]);

  const done = answered((await setup.ask(randomUUID(), "What's the second point?")).body);

  const prompt = setup.openAi.requests[0]?.messages[0]?.content ?? "";
  assert.match(prompt, /^- \[kp2\] /m, "the overview's items carry ids in the cached first message");
  assert.match(prompt, /\[p2 1:01\] Take three to five grams a day\./);
  const message = done.messages[1];
  assert.ok(message?.from === "answer");
  assert.equal(message.inSource, false);
  assert.deepEqual(
    message.citations.map((citation) => ("part" in citation ? { part: citation.part, index: citation.index } : citation)),
    [{ part: "keyPoint", index: 1 }],
    "an id the model wasn't given is dropped",
  );
  assert.equal(answeredFromOverview(message), true);
});

test("ids the model wrote into its answer are left out of what streams and what is stored, and still cited", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams a day [p2]. Step 2 (kp2) covers it.", ["p2"], [], true, ["kp2"])]);

  const response = await setup.ask(randomUUID(), "How much creatine?");

  const streamed = eventsOf(response.body).flatMap((event) => (event.type === "text" ? [event.text] : []));
  assert.equal(streamed.join(""), "Three to five grams a day. Step 2 covers it.");
  const message = answered(response.body).messages[1];
  assert.ok(message?.from === "answer");
  assert.equal(message.text, "Three to five grams a day. Step 2 covers it.");
  assert.equal(message.citations.length, 2);
});

test("the month's allowance, the day's, and the global day refuse before the provider is asked, and say when they reset", async (t) => {
  const setup = await setUp(t, [answer("Fine.")], { dailyChatMessages: 1 });
  const { sql, clock } = setup.testApp;
  const today = clock.now.toISOString().slice(0, 10);
  await sql.query("insert into chat_usage (day, account_id, messages) values ($1::date, $2, 100)", [today, setup.account.accountId]);

  const month = await setup.ask(randomUUID(), "One more?");
  assert.equal(month.statusCode, 429);
  assert.equal(month.json().error.details.quota, "chat-month");
  assert.equal(month.json().error.details.resetsOn, "2026-10-01");
  assert.ok(Number(month.headers["retry-after"]) > 0);

  await sql.query("update accounts set plan = 'plus' where id = $1", [setup.account.accountId]);
  await sql.query("update chat_usage set messages = 200 where account_id = $1", [setup.account.accountId]);
  const day = await setup.ask(randomUUID(), "One more?");
  assert.equal(day.json().error.details.quota, "chat-day");

  await sql.query("update chat_usage set messages = 0 where account_id = $1", [setup.account.accountId]);
  answered((await setup.ask(randomUUID(), "First of the day?")).body);
  const global = await setup.ask(randomUUID(), "Second of the day?");
  assert.equal(global.json().error.details.quota, "chat-our-key-daily");

  assert.equal(setup.openAi.requests.length, 1);
});

test("two questions at once for the last message of the month: one is answered, one waits", async (t) => {
  const setup = await setUp(t, [answer("Fine.")]);
  const today = setup.testApp.clock.now.toISOString().slice(0, 10);
  await setup.testApp.sql.query("insert into chat_usage (day, account_id, messages) values ($1::date, $2, 99)", [
    today,
    setup.account.accountId,
  ]);

  const statuses = (await Promise.all([setup.ask(randomUUID(), "One?"), setup.ask(randomUUID(), "Two?")])).map(
    (response) => response.statusCode,
  );

  assert.deepEqual(statuses.sort(), [200, 429]);
  assert.equal(await usedThisMonth(setup), 100);
});

test("a provider refusing for now is asked again after its wait, quietly", async (t) => {
  const setup = await setUp(t, [{ status: 429, retryAfter: "2" }, { status: 503 }, answer("Fine.")]);

  answered((await setup.ask(randomUUID(), "How much?")).body);

  assert.deepEqual(setup.waits, [2_000, 3_000]);
  assert.equal(await usedThisMonth(setup), 1);
});

test("a provider that keeps failing, or a reply that can't be read, stores nothing and gives the message back", async (t) => {
  const setup = await setUp(t, [{ status: 500 }, { status: 500 }, { status: 500 }, { reply: "not json" }]);
  const [first, second] = [randomUUID(), randomUUID()];

  const refused = await setup.ask(first, "How much?");
  assert.equal(refused.statusCode, 502);
  assert.equal(refused.json().error.code, "generation_failed");

  const broken = await setup.ask(second, "How much?");
  assert.equal(broken.statusCode, 200);
  assert.equal(eventsOf(broken.body).at(-1)?.type, "failed");

  assert.equal(await usedThisMonth(setup), 0);
  const kinds = (await setup.account.changes()).changes.map((change) => change.kind);
  assert.ok(!kinds.includes("chat"));
  const costs = await setup.testApp.sql.query<{ detail: string }>("select detail from account_costs where area = 'chat'");
  assert.deepEqual(
    costs.map(({ detail }) => detail),
    ["message-failed"],
  );
});

const webPage = (title: string): WebSource => {
  const id = randomUUID().replaceAll("-", "");
  return {
    kind: "web",
    id: id as WebSource["id"],
    url: `https://pages.example/${id}`,
    title,
    siteName: "Pages",
    author: null,
    publishedAt: null,
    language: "en",
    imageUrl: null,
    wordCount: 2300,
  };
};

const ARTICLE: Partial<Overview> = {
  source: webPage("Bridge repairs"),
  chapters: null,
  article: {
    chapters: [
      { title: "The closure", summary: "Why it shut.", place: { anchor: null, quote: "The bridge" }, wordCount: 1150 },
      { title: "Who pays", summary: "How it splits.", place: { anchor: "who-pays", quote: "The county" }, wordCount: 1150 },
    ],
    keyPointChapters: [0, 1, null],
    readAnyway: { answer: "no", reason: "Nothing here needs the page.", leftOut: "It leaves out the interviews.", chapterIndexes: [] },
  },
};

const RECIPE_PAGE: Partial<Overview> = {
  source: webPage("Leek stew"),
  keyPoints: [],
  recipe: {
    summary: "A weeknight stew.",
    ingredients: ["3 large leeks", "2 tins cannellini beans"],
    steps: [
      { text: "Roast the leeks for 20 minutes.", group: null },
      { text: "Simmer the beans.", group: null },
    ],
    stepCount: 2,
    prepMinutes: 15,
    cookMinutes: 40,
    totalMinutes: 55,
    yield: "4 servings",
  },
};

const askAbout = async (setup: Setup, overrides: Partial<Overview>, text: string) => {
  const overview = storedOverview(overrides);
  assert.equal((await setup.account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  return setup.ask(randomUUID(), text, overview.id);
};

test("an article is answered from its overview alone: no transcript is needed, its chapters are cited, and it is never the source", async (t) => {
  const setup = await setUp(t, [answer("The chapter on who pays covers it.", ["p2"], [], true, ["ch2", "anyway"])]);

  const response = await askAbout(setup, ARTICLE, "Who pays for it?");

  assert.equal(response.statusCode, 200, response.body);
  const prompt = setup.openAi.requests[0]?.messages[0]?.content ?? "";
  assert.match(prompt, /one article they saved/);
  assert.match(prompt, /\[ch2\] \[Who pays\]/);
  assert.match(prompt, /\[anyway\] No\. Nothing here needs the page\./);
  assert.doesNotMatch(prompt, /# The transcript/);
  const message = answered(response.body).messages[1];
  assert.ok(message?.from === "answer");
  assert.equal(message.inSource, false, "an article has no transcript to be in");
  assert.deepEqual(
    message.citations.map((citation) => ("part" in citation ? `${citation.part}${citation.index}` : "other")),
    ["watchAnyway0", "chapter1"],
  );
  assert.equal(answeredFromOverview(message), true);
});

test("a recipe page is answered from its recipe, and the prompt keeps amounts to the recipe's own scaler", async (t) => {
  const setup = await setUp(t, [answer("Roast the leeks for 20 minutes.", [], [], false, ["method1"])]);

  const response = await askAbout(setup, RECIPE_PAGE, "How long do the leeks roast?");

  assert.equal(response.statusCode, 200, response.body);
  const prompt = setup.openAi.requests[0]?.messages[0]?.content ?? "";
  assert.match(prompt, /one recipe page they saved/);
  assert.match(prompt, /\[ing1\] 3 large leeks/);
  assert.match(prompt, /Never work out an amount yourself/);
  assert.match(prompt, /the recipe doesn't cover it/);
  const message = answered(response.body).messages[1];
  assert.ok(message?.from === "answer");
  assert.deepEqual(
    message.citations.map((citation) => ("part" in citation ? `${citation.part}${citation.index}` : "other")),
    ["method0"],
  );
});

test("no transcript kept, no chat: the panel is told why and nothing is spent", async (t) => {
  const setup = await setUp(t, [answer("Fine.")], { transcript: false });

  const response = await setup.ask(randomUUID(), "How much?");

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "transcript_unavailable");
  assert.equal(response.json().error.details.chat, "no-source");
  assert.equal(setup.openAi.requests.length, 0);
  assert.equal(await usedThisMonth(setup), 0);
});

test("a full conversation, a deleted one, and an overview the account doesn't hold are refused before anything is spent", async (t) => {
  const setup = await setUp(t, [answer("Fine.")]);
  const records = new RecordsRepository(setup.testApp.sql, () => setup.testApp.clock.now);
  const [full, deleted] = [randomUUID(), randomUUID()];
  const at = setup.testApp.clock.now.toISOString();
  const exchange: ChatMessage[] = [
    { from: "reader", text: "q", at },
    { from: "answer", text: "a", at, citations: [], inSource: false },
  ];
  for (let question = 0; question < MAX_CHAT_QUESTIONS; question += 1) {
    await appendChatMessages(
      records,
      setup.account.accountId,
      { overviewId: setup.overviewId, conversationId: full, messages: exchange },
      setup.testApp.clock.now,
    );
  }
  await appendChatMessages(
    records,
    setup.account.accountId,
    { overviewId: setup.overviewId, conversationId: deleted, messages: exchange },
    setup.testApp.clock.now,
  );
  await setup.account.inject({ method: "DELETE", url: `/api/chats/${setup.overviewId}/${deleted}` });

  const tooLong = await setup.ask(full, "One more?");
  assert.equal(tooLong.statusCode, 400);
  assert.equal(tooLong.json().error.details.conversation, "full");
  assert.equal((await setup.ask(deleted, "Again?")).statusCode, 404);
  assert.equal((await setup.ask(randomUUID(), "Anyone?", randomUUID())).statusCode, 404);
  assert.equal(setup.openAi.requests.length, 0);
  assert.equal(await usedThisMonth(setup), 0);
});

test("every line for a chat question names its overview, so a refusal can be tied to the note it was about", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [], { logger });
  const missing = randomUUID();

  const response = await setup.ask(randomUUID(), "Anyone?", missing);

  assert.equal(response.statusCode, 404);
  const reqId = lines.find((line) => line.logCode === "api.http.requestRefused")?.reqId;
  const forRequest = lines.filter((line) => line.reqId === reqId && line.logCode !== "api.http.requestReceived");
  assert.deepEqual(
    forRequest.map((line) => [line.logCode, line.overviewId]),
    [
      ["api.http.requestRefused", missing],
      ["api.http.requestCompleted", missing],
    ],
  );
});

test("a server without our key says chat is unavailable", async (t) => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: `/api/chats/${randomUUID()}/messages`,
    body: { conversationId: randomUUID(), text: "Hello?" },
  });

  assert.equal(response.statusCode, 503);
});

test("a reader who stops an answer, or leaves, before it is stored gets the question back, and nothing is stored", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams a day, with training, and judged by reps.")]);
  const conversationId = randomUUID();
  const { testApp, account } = setup;
  const answerer = new ChatAnswerer({
    apiKey: "sk-test-ours",
    http: setup.openAi.http,
    dailyMessages: 20_000,
    records: new RecordsRepository(testApp.sql, () => testApp.clock.now),
    transcripts: new TranscriptsRepository(testApp.sql, () => testApp.clock.now),
    usage: new ChatUsageRepository(testApp.sql),
    costs: new AccountCostsRepository(testApp.sql),
    clock: () => testApp.clock.now,
  });
  const { logger, lines } = recordingLogger();

  const events = await answerer.ask(
    { accountId: account.accountId, plan: "free" },
    setup.overviewId,
    { conversationId, text: "How much?" },
    logger,
  );
  const first = await events.next();
  await events.return(undefined);

  assert.equal((first.value as ChatStreamEvent).type, "text");
  assert.equal(await usedThisMonth(setup), 0);
  assert.ok(!(await setup.account.changes()).changes.some((change) => change.kind === "chat"));
  assert.ok(lines.some((line) => line.logCode === "api.chat.stopped"));
});
