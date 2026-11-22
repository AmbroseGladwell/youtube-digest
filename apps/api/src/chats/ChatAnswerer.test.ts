import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import {
  answeredFromOverview,
  chatRecordId,
  CHAT_UNITS_PER_ACCOUNT_DAILY,
  CHAT_UNITS_PER_QUESTION,
  chatUnitsOf,
  chatUsageAllowances,
  CURRENT_SCHEMA_VERSIONS,
  overviewPartHash,
  MAX_CHAT_QUESTIONS,
  VideoId,
  youTubeSource,
  type ChatMessage,
  type Overview,
  type WebSource,
  type ChatStreamEvent,
} from "@overview/domain";
import { makeProject, makeStoredTranscript } from "@overview/store-conformance";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { breadNote, conceptEmbedder, foundersNote, noteAbout } from "../testing/meaningFixtures.testHelper.js";
import { storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { ChatAnswerer } from "./ChatAnswerer.js";
import { makeFakeChatOpenAi, type FakeChatAnswer, type FakeChatOpenAi } from "./FakeChatOpenAi.testHelper.js";
import type { Embedder } from "../meaning/Embedder.js";
import { EMBEDDING_DIMENSIONS } from "../meaning/createOpenAiEmbedder.js";

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
  reply: {
    intro: text,
    introSources: [...passages, ...overviewParts, ...chatMessages].map((id) => ({ id, relation: "Supports" })),
    sections: [],
    takeaway: "",
    inSource,
    generalKnowledge,
  },
});

interface Setup {
  testApp: TestApp;
  account: TestAccount;
  openAi: FakeChatOpenAi;
  overviewId: string;
  waits: number[];
  ask(conversationId: string, text: string, overviewId?: string, extra?: Record<string, unknown>): ReturnType<TestAccount["inject"]>;
}

const setUp = async (
  t: TestContext,
  answers: FakeChatAnswer[],
  {
    dailyChatMessages = 20_000,
    transcript = true,
    logger,
    embedder,
  }: { dailyChatMessages?: number; transcript?: boolean; logger?: FastifyBaseLogger; embedder?: Embedder } = {},
): Promise<Setup> => {
  const openAi = makeFakeChatOpenAi(...answers);
  const waits: number[] = [];
  const testApp = await createTestApp(
    {},
    {
      ourKey: {
        apiKey: "sk-test-ours",
        dailyGenerations: 300,
        dailyChatMessages,
        http: openAi.http,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
      ...(logger === undefined ? {} : { logger }),
      ...(embedder === undefined ? {} : { embedder }),
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
    ask: (conversationId, text, overviewId = overview.id, extra = {}) =>
      account.inject({ method: "POST", url: `/api/chats/${overviewId}/messages`, body: { conversationId, text, ...extra } }),
  };
};

const withoutSections = (message: ChatMessage | undefined) => {
  const { sections: _sections, ...rest } = message as Extract<ChatMessage, { from: "answer" }>;
  return rest;
};

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

const unitsThisMonth = async (setup: Setup) => {
  const [row] = await setup.testApp.sql.query<{ units: string | null }>("select sum(units) as units from chat_usage");
  return Number(row?.units ?? 0);
};

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
  assert.deepEqual(withoutSections(done.messages[1]), {
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
    share: chatUnitsOf(0.00032) / chatUsageAllowances.free,
    libraryFits: true,
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

test("with nothing known about the reader, chat says so and logs it as not personalised", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("Three to five grams a day.")], { logger });

  answered((await setup.ask(randomUUID(), "How much creatine?")).body);

  assert.ok((setup.openAi.requests[0]?.messages[0]?.content ?? "").includes("# The reader\n\nNothing is known about the reader yet"));
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
  assert.deepEqual(withoutSections(built.messages[1]), {
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

  assert.deepEqual(withoutSections(done.messages[1]), {
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
  assert.deepEqual(withoutSections(done.messages[1]), {
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

test("the month's usage, the day's, and the global day refuse before the provider is asked, and say when they reset (OV-376)", async (t) => {
  const setup = await setUp(t, [answer("Fine.")], { dailyChatMessages: 1 });
  const { sql, clock } = setup.testApp;
  const today = clock.now.toISOString().slice(0, 10);
  await sql.query("insert into chat_usage (day, account_id, messages, units) values ($1::date, $2, 3, $3)", [
    today,
    setup.account.accountId,
    chatUsageAllowances.free,
  ]);

  const month = await setup.ask(randomUUID(), "One more?");
  assert.equal(month.statusCode, 429);
  assert.equal(month.json().error.details.quota, "chat-month");
  assert.equal(month.json().error.details.scope, undefined);
  assert.equal(month.json().error.details.resetsOn, "2026-10-01");
  assert.ok(Number(month.headers["retry-after"]) > 0);

  await sql.query("update accounts set plan = 'plus' where id = $1", [setup.account.accountId]);
  await sql.query("update chat_usage set units = $2 where account_id = $1", [setup.account.accountId, CHAT_UNITS_PER_ACCOUNT_DAILY]);
  const day = await setup.ask(randomUUID(), "One more?");
  assert.equal(day.json().error.details.quota, "chat-day");

  await sql.query("update chat_usage set units = 0 where account_id = $1", [setup.account.accountId]);
  await sql.query("insert into our_key_usage (day, chat_units) values ($1::date, $2)", [today, CHAT_UNITS_PER_QUESTION]);
  const global = await setup.ask(randomUUID(), "One more?");
  assert.equal(global.json().error.details.quota, "chat-our-key-daily");

  assert.equal(setup.openAi.requests.length, 0);
});

test("a question goes ahead while the month is under its usage, and its real cost may take the month a little past it", async (t) => {
  const setup = await setUp(t, [answer("Fine.")]);
  const today = setup.testApp.clock.now.toISOString().slice(0, 10);
  await setup.testApp.sql.query("insert into chat_usage (day, account_id, messages, units) values ($1::date, $2, 99, $3)", [
    today,
    setup.account.accountId,
    chatUsageAllowances.free - 1,
  ]);

  answered((await setup.ask(randomUUID(), "One?")).body);
  const usage = (await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { share: number; libraryFits: boolean };
  assert.ok(usage.share > 1);
  assert.equal(usage.libraryFits, false);
  assert.equal((await setup.ask(randomUUID(), "Two?")).json().error.details.quota, "chat-month");
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
  assert.equal(await unitsThisMonth(setup), 0);
  const kinds = (await setup.account.changes()).changes.map((change) => change.kind);
  assert.ok(!kinds.includes("chat"));
  const costs = await setup.testApp.sql.query<{ detail: string }>("select detail from account_costs where area = 'chat'");
  assert.deepEqual(
    costs.map(({ detail }) => detail),
    ["message-failed"],
  );
});

test("an answer spends its real cost as usage, beside the count, and the month's share says how much is gone (OV-376)", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("Fine.")], { logger });

  answered((await setup.ask(randomUUID(), "How much?")).body);
  answered((await setup.ask(randomUUID(), "And after?")).body);

  const spent = lines.filter((line) => line.logCode === "api.chat.answered").map((line) => line.usageUnits as number);
  assert.deepEqual(
    spent,
    lines.filter((line) => line.logCode === "api.chat.answered").map((line) => chatUnitsOf(line.costDollars as number)),
  );
  assert.ok(spent.every((units) => units > 0));
  assert.equal(await unitsThisMonth(setup), spent[0]! + spent[1]!);
  const usage = (await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { used: number; share: number };
  assert.equal(usage.used, 2);
  assert.equal(usage.share, (spent[0]! + spent[1]!) / chatUsageAllowances.free);
  const [library] = await setup.testApp.sql.query<{ units: string }>("select sum(library_units) as units from chat_usage");
  assert.equal(Number(library?.units), 0);
  const [global] = await setup.testApp.sql.query<{ chat_units: string }>("select chat_units from our_key_usage");
  assert.equal(Number(global?.chat_units), spent[0]! + spent[1]!);
});

test("usage is cost in millionths of a dollar, and one question about long-form content is the allowance's unit (OV-376)", () => {
  assert.equal(chatUnitsOf(0.0014), 1_400);
  assert.equal(chatUnitsOf(0.00000049), 0);
  assert.equal(chatUnitsOf(-1), 0);
  assert.equal(chatUsageAllowances.plus / chatUsageAllowances.free, 10);
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
      { owner: { kind: "overview", id: setup.overviewId }, conversationId: full, messages: exchange },
      setup.testApp.clock.now,
    );
  }
  await appendChatMessages(
    records,
    setup.account.accountId,
    { owner: { kind: "overview", id: setup.overviewId }, conversationId: deleted, messages: exchange },
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
    meaningSearch: null,
    passages: null,
    clock: () => testApp.clock.now,
  });
  const { logger, lines } = recordingLogger();

  const events = await answerer.ask(
    { accountId: account.accountId, plan: "free", acrossSources: true },
    setup.overviewId,
    { conversationId, text: "How much?", pins: { overviews: [], projects: [] }, setAside: [], searchLibrary: true },
    logger,
  );
  const first = await events.next();
  await events.return(undefined);

  assert.equal((first.value as ChatStreamEvent).type, "text");
  assert.equal(await usedThisMonth(setup), 0);
  assert.ok(!(await setup.account.changes()).changes.some((change) => change.kind === "chat"));
  assert.ok(lines.some((line) => line.logCode === "api.chat.stopped"));
});

const titled = <T extends Overview>(overview: T, title: string): T => ({ ...overview, source: { ...overview.source, title } });

const otherAnswer = (text: string, overviewParts: string[]) => answer(text, [], [], false, overviewParts);

const saved = async (setup: Setup, ...overviews: Overview[]): Promise<void> => {
  for (const overview of overviews) {
    const response = await setup.account.inject({ method: "POST", url: "/api/overviews", body: overview });
    assert.equal(response.statusCode, 201, response.body);
  }
  await setup.testApp.drainEmbeddings();
};

const projectOf = async (setup: Setup, overviews: Overview[], name = "Leadership"): Promise<string> => {
  const project = { ...makeProject({ name }), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT };
  assert.equal((await setup.account.inject({ method: "POST", url: "/api/projects", body: project })).statusCode, 201);
  for (const [index, overview] of overviews.entries()) {
    const added = await setup.account.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/members/${overview.id}`,
      body: { updatedAt: UPDATED_AT, addedAt: new Date(Date.UTC(2026, 10, 1, 9, index)).toISOString() },
    });
    assert.ok(added.statusCode < 300, added.body);
  }
  return project.id;
};

const readerMessages = async (setup: Setup, conversation: string) =>
  ((await setup.account.change("chat", chatRecordId(setup.overviewId, conversation))).body as { messages: ChatMessage[] }).messages.filter(
    (message) => message.from === "reader",
  );

test("search adds the closest other overviews, never the chat's own, as overviews only before the question, and an answer cites one by its label", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [otherAnswer("Boards rarely push back on founders who stay.", ["S1.kp2", "S1", "S9", "S1.kp99"])], {
    embedder: conceptEmbedder(),
    logger,
  });
  const founders = titled(foundersNote(), "Founders who stay too long");
  await saved(setup, founders, breadNote());
  const conversation = randomUUID();

  const response = await setup.ask(conversation, "What happens when leaders overstay?");

  const events = eventsOf(response.body);
  assert.deepEqual(events[0], {
    type: "sources",
    pinned: [],
    found: [{ label: "S1", overviewId: founders.id, title: "Founders who stay too long", how: "found" }],
  });
  const messages = setup.openAi.requests[0]!.messages;
  assert.equal(messages.length, 3);
  assert.equal(messages[1]?.role, "user");
  assert.match(messages[1]?.content ?? "", /^# Other overviews from the reader's library/);
  assert.match(messages[1]?.content ?? "", /## S1\n/);
  assert.match(messages[1]?.content ?? "", /\[S1\.kp2\] Boards rarely push back/);
  assert.doesNotMatch(messages[1]?.content ?? "", /sourdough|## S2/i);
  assert.deepEqual(messages[2], { role: "user", content: "What happens when leaders overstay?" });

  const done = answered(response.body);
  assert.deepEqual(done.messages[0], {
    from: "reader",
    text: "What happens when leaders overstay?",
    at: setup.testApp.clock.now.toISOString(),
    sources: [{ label: "S1", overviewId: founders.id, title: "Founders who stay too long", how: "found" }],
  });
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(reply.citations, [
    {
      overviewId: founders.id,
      title: "Founders who stay too long",
      item: { part: "keyPoint", index: 1, textHash: overviewPartHash("Boards rarely push back") },
    },
  ]);
  assert.equal(reply.inSource, false);
  const line = lines.find((each) => each.logCode === "api.chat.answered");
  assert.equal(line?.["foundSources"], 1);
  assert.equal(line?.["pinnedSources"], 0);
  assert.equal(line?.["searched"], true);
  assert.equal(line?.["otherOverviewCitations"], 1);
});

test("a follow-up adds what it finds after the history, sends nothing already there again, and leaves the earlier prompt as it was", async (t) => {
  const setup = await setUp(t, [otherAnswer("They stay.", ["S1"])], { embedder: conceptEmbedder() });
  const founders = foundersNote();
  const bread = titled(breadNote(), "Sourdough");
  await saved(setup, founders, bread);
  const conversation = randomUUID();

  answered((await setup.ask(conversation, "What happens when leaders overstay?")).body);
  const again = await setup.ask(conversation, "And founders clinging on?");
  answered(again.body);
  assert.ok(!eventsOf(again.body).some((event) => event.type === "sources"));
  const baking = await setup.ask(conversation, "How long should the dough prove?");
  answered(baking.body);

  const [first, second, third] = setup.openAi.requests.map((request) => request.messages);
  assert.deepEqual(second!.slice(0, first!.length), first);
  assert.equal(second!.length, first!.length + 2);
  assert.deepEqual(third!.slice(0, second!.length), second);
  const added = third!.at(-2)!;
  assert.equal(added.role, "user");
  assert.match(added.content, /^# More overviews from the reader's library/);
  assert.match(added.content, /## S2\n/);
  assert.doesNotMatch(added.content, /## S1\n/);
  assert.deepEqual(
    (await readerMessages(setup, conversation)).map((message) =>
      message.from === "reader" ? message.sources?.map((source) => source.label) : null,
    ),
    [["S1"], undefined, ["S2"]],
  );
});

test("pins go in whether or not search would find them, and with no search at all, but never the chat's own overview", async (t) => {
  const setup = await setUp(t, [otherAnswer("Bake it in a lidded pot.", ["S1.kp3"])]);
  const bread = titled(breadNote(), "Sourdough");
  await saved(setup, bread);

  const response = await setup.ask(randomUUID(), "What happens when leaders overstay?", setup.overviewId, {
    pins: { overviews: [bread.id, setup.overviewId] },
  });

  assert.deepEqual(eventsOf(response.body)[0], {
    type: "sources",
    pinned: [{ label: "S1", overviewId: bread.id, title: "Sourdough", how: "pinned" }],
    found: [],
  });
  const block = setup.openAi.requests[0]!.messages[1]!.content;
  assert.match(block, /The reader pinned S1 to this conversation with "@"\./);
  assert.doesNotMatch(block, /## S2/);
  const reply = answered(response.body).messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    reply.citations.map((citation) => ("overviewId" in citation ? citation.item?.part : null)),
    ["keyPoint"],
  );
});

test("a pinned project goes in whole up to eight, and past that its five closest whole and the rest in brief", async (t) => {
  const setup = await setUp(t, [otherAnswer("Boards rarely push back.", ["S1.kp2", "S7"])], { embedder: conceptEmbedder() });
  const founders = titled(foundersNote(), "Founders who stay too long");
  const small = [
    founders,
    ...Array.from({ length: 3 }, (_, index) =>
      titled(noteAbout(`Claim ${index}`, ["A point", "Another point", "A third point"]), `Talk ${index}`),
    ),
  ];
  const more = Array.from({ length: 6 }, (_, index) =>
    titled(noteAbout(`Other claim ${index}`, ["A point", "Another point", "A third point"]), `Extra ${index}`),
  );
  await saved(setup, ...small, ...more);
  const smallProject = await projectOf(setup, small, "Small");
  const largeProject = await projectOf(setup, [...small, ...more], "Large");

  answered(
    (await setup.ask(randomUUID(), "What do leaders who overstay do?", setup.overviewId, { pins: { projects: [smallProject] } })).body,
  );
  const whole = setup.openAi.requests[0]!.messages[1]!.content;
  assert.match(whole, /The reader pinned their project "Small" to this conversation/);
  assert.equal(whole.match(/^## S\d+$/gm)?.length, 4);
  assert.doesNotMatch(whole, /in brief/);

  const response = await setup.ask(randomUUID(), "What do leaders who overstay do?", setup.overviewId, {
    pins: { projects: [largeProject] },
  });
  const block = setup.openAi.requests[1]!.messages.at(-2)!.content;
  assert.equal(block.match(/^## S\d+$/gm)?.length, 5);
  assert.match(block, /## S1\n\n# Founders who stay too long/);
  assert.match(block, /# The rest of "Large", in brief/);
  assert.equal(block.match(/^## \[S\d+\] /gm)?.length, 5);
  const done = answered(response.body);
  const sources = (done.messages[0] as Extract<ChatMessage, { from: "reader" }>).sources ?? [];
  assert.equal(sources.length, 10);
  assert.equal(sources.filter((source) => source.brief === true).length, 5);
  assert.ok(sources.every((source) => source.how === "pinned" && source.projectId === largeProject));
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  const brief = sources.find((source) => source.label === "S7")!;
  assert.deepEqual(
    reply.citations.flatMap((citation) => ("overviewId" in citation ? [[citation.overviewId, citation.item === null]] : [])),
    [
      [founders.id, false],
      [brief.overviewId, true],
    ],
  );
});

test("setting an overview aside says so in a new message, keeps the earlier prompt, and its label is no longer cited", async (t) => {
  const setup = await setUp(t, [otherAnswer("Feed the starter.", ["S1.kp1"])]);
  const bread = titled(breadNote(), "Sourdough");
  await saved(setup, bread);
  const conversation = randomUUID();

  answered((await setup.ask(conversation, "What about bread?", setup.overviewId, { pins: { overviews: [bread.id] } })).body);
  const response = await setup.ask(conversation, "Ignore that one. What now?", setup.overviewId, { setAside: [bread.id] });

  const [first, second] = setup.openAi.requests.map((request) => request.messages);
  assert.deepEqual(second!.slice(0, first!.length), first);
  assert.deepEqual(second!.at(-2), {
    role: "user",
    content: "The reader set aside S1 (Sourdough) from this conversation. Don't use or cite it from here on.",
  });
  const done = answered(response.body);
  assert.deepEqual((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).setAside, ["S1"]);
  assert.deepEqual((done.messages[1] as Extract<ChatMessage, { from: "answer" }>).citations, []);
});

test("a client before cross-source chat is answered from its own overview alone, as before", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams a day.")], { embedder: conceptEmbedder() });
  await saved(setup, foundersNote());

  const response = await setup.account.inject({
    method: "POST",
    url: `/api/chats/${setup.overviewId}/messages`,
    body: { conversationId: randomUUID(), text: "What happens when leaders overstay?", pins: { overviews: [] } },
    clientVersion: 24,
  });

  assert.ok(!eventsOf(response.body).some((event) => event.type === "sources"));
  assert.equal(setup.openAi.requests[0]!.messages.length, 2);
  assert.equal((answered(response.body).messages[0] as Extract<ChatMessage, { from: "reader" }>).sources, undefined);
});

test("an empty reply is logged as one", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("", [])], { logger });

  const response = await setup.ask(randomUUID(), "How much?");

  assert.equal(eventsOf(response.body).at(-1)?.type, "failed");
  assert.equal(lines.find((line) => line.logCode === "api.chat.failed")?.["reason"], "EmptyAnswerError");
});

test("a reply cut off at its token cap fails as one, gives the question back, and is logged as cut off (OV-353)", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [{ reply: '{"answer":"', finishReason: "length" }], { logger });

  const response = await setup.ask(randomUUID(), "How would my desserts score?");

  assert.equal(eventsOf(response.body).at(-1)?.type, "failed");
  assert.equal(await usedThisMonth(setup), 0);
  assert.equal(lines.find((line) => line.logCode === "api.chat.failed")?.["reason"], "AnswerCutOffError");
});

const keptWithTranscript = async (setup: Setup, title: string, segments: Array<{ text: string; startMs: number; endMs: number }>) => {
  const stored = makeStoredTranscript({ videoId: VideoId.parse(randomUUID().slice(0, 11)), segments });
  const overview = titled(storedOverview({ source: youTubeSource(stored.video!) }), title);
  assert.equal((await setup.account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  assert.equal((await setup.account.inject({ method: "PUT", url: `/api/transcripts/${stored.videoId}`, body: stored })).statusCode, 204);
  return overview;
};

const minuteOf = (index: number, text: string) => ({ text, startMs: index * 60_000, endMs: index * 60_000 + 50_000 });

test("the best minutes of the overviews a question reads go with it, each with its neighbours, never from one it doesn't read, and an answer cites one as a time (OV-352, OV-362)", async (t) => {
  const { lines, logger } = recordingLogger();
  const setup = await setUp(t, [answer("Take 300 milligrams an hour before bed.", ["S1.p3", "S1.p99", "p2"], [], true)], { logger });
  const sleep = await keptWithTranscript(setup, "Sleep better", [
    minuteOf(0, "Welcome, today it's sleep."),
    minuteOf(1, "Recovery needs sleep."),
    minuteOf(2, "Take 300 milligrams of ashwagandha an hour before bed."),
    minuteOf(3, "Then keep the room cool."),
    minuteOf(4, "That's all."),
  ]);
  const unread = await keptWithTranscript(setup, "Herbs for stress", [minuteOf(0, "Ashwagandha is popular for stress.")]);
  const conversation = randomUUID();

  const response = await setup.ask(conversation, "How much ashwagandha should I take?", setup.overviewId, {
    pins: { overviews: [sleep.id] },
  });

  assert.deepEqual(eventsOf(response.body)[0], {
    type: "sources",
    pinned: [{ label: "S1", overviewId: sleep.id, title: "Sleep better", how: "pinned" }],
    found: [],
  });
  const block = setup.openAi.requests[0]!.messages.at(-2)!.content;
  assert.match(block, /# Minutes of their transcripts that match the question's words/);
  assert.match(
    block,
    /## S1: Sleep better\n\n\[S1\.p2 1:00\] Recovery needs sleep\.\n\[S1\.p3 2:00\] Take 300 milligrams of ashwagandha an hour before bed\.\n\[S1\.p4 3:00\] Then keep the room cool\./,
  );
  assert.doesNotMatch(block, /Creatine/);
  assert.doesNotMatch(block, /Ashwagandha is popular for stress/);
  assert.ok(!JSON.stringify(eventsOf(response.body)).includes(unread.id));
  const done = answered(response.body);
  assert.deepEqual((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).minutes, [
    { overviewId: sleep.id, passages: ["p2", "p3", "p4"] },
  ]);
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(reply.citations, [
    { startMs: 61_000, endMs: 70_000 },
    { overviewId: sleep.id, title: "Sleep better", item: null, range: { startMs: 120_000, endMs: 170_000 } },
  ]);
  const line = lines.find((each) => each.logCode === "api.chat.answered");
  assert.equal(line?.["keywordMinutes"], 3);
  assert.equal(line?.["minuteCitations"], 1);

  answered((await setup.ask(conversation, "And when?")).body);
  const [first, second] = setup.openAi.requests.map((request) => request.messages);
  assert.deepEqual(second!.slice(0, first!.length), first);
});

test("the chat's own transcript and an overview set aside are never searched for minutes", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams.")]);
  const other = await keptWithTranscript(setup, "Creatine again", [minuteOf(0, "Creatine at three to five grams a day.")]);
  const conversation = randomUUID();
  answered((await setup.ask(conversation, "Creatine grams?", setup.overviewId, { pins: { overviews: [other.id] } })).body);

  answered((await setup.ask(conversation, "Creatine grams again?", setup.overviewId, { setAside: [other.id] })).body);

  const [first, second] = setup.openAi.requests.map((request) => request.messages);
  assert.match(first!.at(-2)!.content, /\[S1\.p1 0:00\] Creatine at three to five grams a day\./);
  assert.doesNotMatch(first!.at(-2)!.content, /Take three to five grams a day\./);
  assert.doesNotMatch(
    second!
      .slice(first!.length)
      .map((message) => message.content)
      .join("\n"),
    /# Minutes of their transcripts/,
  );
});

test("every answer is stored in the shared shape: a simple one as its intro with its sources, a longer one in sections (OV-354)", async (t) => {
  const setup = await setUp(t, [
    answer("Three to five grams a day.", ["p2"]),
    {
      reply: {
        intro: "There are two ways to take it.",
        introSources: [],
        sections: [
          {
            heading: "Daily",
            paragraphs: ["Take it every day (p2)."],
            numbered: [],
            bullets: [],
            sources: [
              { id: "p2", relation: "Supports" },
              { id: "p9", relation: "Supports" },
            ],
          },
          {
            heading: "Where they differ",
            paragraphs: ["Loading is optional — or skip it."],
            numbered: [
              { text: "Load for a week", sources: ["p1", "p1", "p404"] },
              { text: "Then keep to the daily dose", sources: [] },
            ],
            bullets: [],
            sources: [
              { id: "p1", relation: "For loading when you want results in a week rather than a month" },
              { id: "p2", relation: "  " },
            ],
          },
        ],
        takeaway: "Take it daily.",
        inSource: true,
        generalKnowledge: false,
      },
    },
  ]);
  const conversation = randomUUID();

  const simple = answered((await setup.ask(conversation, "How much?")).body).messages[1] as Extract<ChatMessage, { from: "answer" }>;
  const response = await setup.ask(conversation, "How do I take it?");

  assert.deepEqual(simple.sections, {
    intro: "Three to five grams a day.",
    introSources: [{ citation: { startMs: 61_000, endMs: 70_000 }, relation: "Based on" }],
    sections: [],
    takeaway: "",
  });
  const events = eventsOf(response.body);
  assert.equal(events.filter((event) => event.type === "section").length, 2);
  const long = answered(response.body).messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(long.sections?.sections[0], {
    heading: "Daily",
    paragraphs: ["Take it every day."],
    numbered: [],
    bullets: [],
    sources: [{ citation: { startMs: 61_000, endMs: 70_000 }, relation: "Based on" }],
  });
  assert.deepEqual(
    long.sections?.sections[1]?.sources.map((source) => source.relation),
    ["For loading when you want results in a", "Based on"],
  );
  assert.deepEqual(long.sections?.sections[1]?.numbered, [
    { text: "Load for a week", sources: [long.sections?.sections[1]?.sources[0]?.citation] },
    { text: "Then keep to the daily dose", sources: [] },
  ]);
  assert.equal(
    long.text,
    "There are two ways to take it.\n\nDaily\nTake it every day.\n\nWhere they differ\nLoading is optional, or skip it.\n1. Load for a week\n2. Then keep to the daily dose\n\nTake it daily.",
  );
});

test("only an overview close to the question is found for it, never the merely nearest (OV-362)", async (t) => {
  const unrelatedOverviewSimilarity = 0.38;
  const vectorOf = (text: string) => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    if (/close/i.test(text)) {
      vector[0] = 1;
    } else {
      vector[0] = unrelatedOverviewSimilarity;
      vector[1] = Math.sqrt(1 - unrelatedOverviewSimilarity ** 2);
    }
    return vector;
  };
  const embedder: Embedder = {
    model: "fixed-test",
    dollarsPerMillionTokens: 0.02,
    dimensions: EMBEDDING_DIMENSIONS,
    embed: async (texts) => ({ vectors: texts.map(vectorOf), tokens: texts.length }),
  };
  const setup = await setUp(t, [answer("Three to five grams.")], { embedder });
  const close = titled(noteAbout("Close claim", ["Close point one", "Close point two", "Close point three"]), "Close one");
  const far = titled(noteAbout("Far claim", ["Far point one", "Far point two", "Far point three"]), "Far one");
  await saved(setup, close, far);

  const response = await setup.ask(randomUUID(), "What does the close one say?");

  assert.deepEqual(eventsOf(response.body)[0], {
    type: "sources",
    pinned: [],
    found: [{ label: "S1", overviewId: close.id, title: "Close one", how: "found" }],
  });
});

test("with Search my library off, nothing is found by meaning or by words, pins still go in, and the question says so", async (t) => {
  const setup = await setUp(t, [answer("Three to five grams.")], { embedder: conceptEmbedder() });
  const founders = foundersNote();
  const pinned = titled(breadNote(), "Sourdough");
  await saved(setup, founders, pinned);

  const response = await setup.ask(randomUUID(), "What happens when leaders overstay?", setup.overviewId, {
    pins: { overviews: [pinned.id] },
    searchLibrary: false,
  });

  assert.deepEqual(eventsOf(response.body)[0], {
    type: "sources",
    pinned: [{ label: "S1", overviewId: pinned.id, title: "Sourdough", how: "pinned" }],
    found: [],
  });
  assert.equal((answered(response.body).messages[0] as Extract<ChatMessage, { from: "reader" }>).searchedLibrary, false);
});
