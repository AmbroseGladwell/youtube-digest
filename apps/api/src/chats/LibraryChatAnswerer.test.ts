import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  chatRecordId,
  CURRENT_SCHEMA_VERSIONS,
  overviewPartHash,
  type ChatMessage,
  type ChatStreamEvent,
  type Overview,
} from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { noteAbout } from "../testing/meaningFixtures.testHelper.js";
import { UPDATED_AT } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { makeFakeChatOpenAi, type FakeChatAnswer, type FakeChatOpenAi } from "./FakeChatOpenAi.testHelper.js";
import { LibraryChatAnswerer, type LibraryChatOwner } from "./LibraryChatAnswerer.js";

interface Setup {
  testApp: TestApp;
  account: TestAccount;
  openAi: FakeChatOpenAi;
  lines: Array<Record<string, unknown>>;
  ask(owner: LibraryChatOwner, conversationId: string, text: string): Promise<ChatStreamEvent[]>;
}

async function setUp(t: TestContext, answers: FakeChatAnswer[], { wholeCharacters }: { wholeCharacters?: number } = {}): Promise<Setup> {
  const openAi = makeFakeChatOpenAi(...answers);
  const testApp = await createTestApp(
    {},
    {
      ourKey: {
        apiKey: "sk-test-ours",
        dailyGenerations: 300,
        signedOutDailyGenerations: 50,
        dailyChatMessages: 20_000,
        http: openAi.http,
        sleep: async () => {},
      },
    },
  );
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const { logger, lines } = recordingLogger();
  const answerer = new LibraryChatAnswerer({
    apiKey: "sk-test-ours",
    http: openAi.http,
    dailyMessages: 20_000,
    records: new RecordsRepository(testApp.sql, () => testApp.clock.now),
    usage: new ChatUsageRepository(testApp.sql),
    costs: new AccountCostsRepository(testApp.sql),
    clock: () => testApp.clock.now,
    ...(wholeCharacters === undefined ? {} : { wholeCharacters }),
  });
  return {
    testApp,
    account,
    openAi,
    lines,
    ask: async (owner, conversationId, text) => {
      const events: ChatStreamEvent[] = [];
      for await (const event of await answerer.ask(
        { accountId: account.accountId, plan: "free" },
        owner,
        { conversationId, text },
        logger,
      )) {
        events.push(event);
      }
      return events;
    },
  };
}

const titled = (title: string, savedAt: string, points = ["Start with one habit", "Charge from day one", "Keep it small"]): Overview => {
  const overview = noteAbout(`${title} claim`, points, { savedAt });
  return { ...overview, source: { ...overview.source, title } };
};

async function saved(setup: Setup, ...overviews: Overview[]) {
  for (const overview of overviews) {
    const response = await setup.account.inject({ method: "POST", url: "/api/overviews", body: overview });
    assert.equal(response.statusCode, 201, response.body);
  }
}

async function projectOf(setup: Setup, overviews: Overview[], removed: Overview[] = []) {
  const project = {
    ...makeProject({ name: "Indie apps" }),
    purpose: "Apps I can run alone",
    schemaVersion: CURRENT_SCHEMA_VERSIONS.project,
    updatedAt: UPDATED_AT,
  };
  assert.equal((await setup.account.inject({ method: "POST", url: "/api/projects", body: project })).statusCode, 201);
  for (const overview of [...overviews, ...removed]) {
    const url = `/api/projects/${project.id}/members/${overview.id}`;
    await setup.account.inject({ method: "PUT", url, body: { updatedAt: UPDATED_AT, addedAt: "2026-11-01T09:00:00.000Z" } });
  }
  for (const overview of removed) {
    const url = `/api/projects/${project.id}/members/${overview.id}`;
    await setup.account.inject({ method: "PUT", url, body: { updatedAt: UPDATED_AT, removedAt: "2026-11-02T09:00:00.000Z" } });
  }
  return project;
}

const sectioned = (sections: Array<{ heading: string; points: Array<{ text: string; sources: string[] }> }>) => ({
  reply: { intro: "Most of them start small.", sections, takeaway: "Pick one habit." },
});

const answeredOf = (events: ChatStreamEvent[]) => {
  const last = events.at(-1);
  assert.equal(last?.type, "answered", JSON.stringify(events.at(-1)));
  return last as Extract<ChatStreamEvent, { type: "answered" }>;
};

const usedThisMonth = async (setup: Setup) =>
  ((await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { used: number }).used;

test("a small project goes whole in one pass, with its purpose, and answers in sections whose points cite by code", async (t) => {
  const setup = await setUp(t, [
    sectioned([{ heading: "Scope", points: [{ text: "Begin with one habit (O1.kp1).", sources: ["O1.kp1", "O2", "O9", "O1.kp99"] }] }]),
  ]);
  const [older, newer, gone] = [
    titled("Cardstock", "2026-11-01T09:00:00.000Z"),
    titled("Tiny SaaS", "2026-11-02T09:00:00.000Z"),
    titled("Left out", "2026-11-03T09:00:00.000Z"),
  ];
  await saved(setup, older, newer, gone);
  const project = await projectOf(setup, [newer, older], [gone]);
  const conversation = randomUUID();

  const events = await setup.ask({ kind: "project", id: project.id }, conversation, "What do these share?");

  assert.equal(setup.openAi.requests.length, 1);
  const [system, question] = setup.openAi.requests[0]!.messages;
  assert.match(
    system!.content,
    /about one of their projects in The Overview, "Indie apps", which they keep for this: "Apps I can run alone", listed below in full/,
  );
  assert.match(system!.content, /## \[O1\]\n\n# Cardstock[\s\S]*## \[O2\]\n\n# Tiny SaaS/);
  assert.match(system!.content, /\[O1\.kp1\] Start with one habit/);
  assert.doesNotMatch(system!.content, /Left out/);
  assert.deepEqual(question, { role: "user", content: "What do these share?" });
  assert.deepEqual(
    events.map((event) => event.type).filter((type, index, all) => all.indexOf(type) === index),
    ["text", "section", "answered"],
  );
  const section = events.find((event) => event.type === "section") as Extract<ChatStreamEvent, { type: "section" }>;
  assert.equal(section.section.points[0]!.text, "Begin with one habit.");

  const done = answeredOf(events);
  const answer = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(answer.sections?.sections[0]?.points[0]?.citations, [
    { overviewId: older.id, title: "Cardstock", item: { part: "keyPoint", index: 0, textHash: overviewPartHash("Start with one habit") } },
    { overviewId: newer.id, title: "Tiny SaaS", item: null },
  ]);
  assert.deepEqual(answer.stats, { overviews: 2 });
  assert.equal(answer.inSource, false);
  assert.match(answer.text, /^Most of them start small\.\n\nScope\n- Begin with one habit\.\n\nPick one habit\.$/);
  assert.equal((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).picked, undefined);
  const stored = await setup.account.change("chat", chatRecordId({ kind: "project", id: project.id }, conversation));
  assert.equal((stored.body as { projectId: string }).projectId, project.id);
  assert.equal(await usedThisMonth(setup), 1);
  assert.equal(setup.lines.find((line) => line["logCode"] === "api.chat.answered")?.["mode"], "whole");
});

test("a large library is read in two passes: it picks from the map, reads the picks whole, and only what it read cites an item", async (t) => {
  const setup = await setUp(
    t,
    [
      { reply: { overviews: ["O1", "O3.kp2", "O7", "O1"] } },
      sectioned([
        { heading: "Money", points: [{ text: "Charge early.", sources: ["O1.kp2", "O2.kp1", "O3"] }] },
        { heading: "Size", points: [{ text: "Stay small.", sources: ["O3.kp3"] }] },
      ]),
    ],
    { wholeCharacters: 10 },
  );
  const overviews = [
    titled("First", "2026-11-01T09:00:00.000Z"),
    titled("Second", "2026-11-02T09:00:00.000Z"),
    titled("Third", "2026-11-03T09:00:00.000Z"),
  ];
  await saved(setup, ...overviews);
  await projectOf(setup, [overviews[0]!]);

  const events = await setup.ask({ kind: "library" }, randomUUID(), "What makes money?");

  assert.equal(events[0]?.type, "picking");
  assert.deepEqual(events[1], {
    type: "picked",
    overviews: [
      { overviewId: overviews[0]!.id, title: "First" },
      { overviewId: overviews[2]!.id, title: "Third" },
    ],
  });
  assert.deepEqual(events.filter((event) => event.type === "section").length, 2);
  const [pick, answer] = setup.openAi.requests.map((request) => request.messages);
  assert.match(pick![0]!.content, /listed below in brief[\s\S]*Choose up to 5/);
  assert.match(pick![0]!.content, /## \[O2\] Second\nSecond claim/);
  assert.equal(pick!.at(-1)!.content, "Choose the overviews whose full notes you need to answer this question: What makes money?");
  assert.deepEqual(answer![0], pick![0]);
  assert.match(answer![1]!.content, /^The full notes of the overviews you chose:\n\n## \[O1\]\n\n# First[\s\S]*## \[O3\]\n\n# Third/);
  assert.doesNotMatch(answer![1]!.content, /# Second/);
  assert.deepEqual(answer![2], { role: "user", content: "What makes money?" });

  const done = answeredOf(events);
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    reply.sections!.sections.flatMap((section) =>
      section.points[0]!.citations.map((citation) => [citation.title, citation.item?.index ?? null]),
    ),
    [
      ["First", 1],
      ["Second", null],
      ["Third", null],
      ["Third", 2],
    ],
  );
  assert.deepEqual(reply.stats, { overviews: 3, projects: 1 });
  assert.deepEqual((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).picked, [overviews[0]!.id, overviews[2]!.id]);
  assert.equal(await usedThisMonth(setup), 1);
  const costs = await setup.testApp.sql.query<{ detail: string }>(
    "select detail from account_costs where account_id = $1 and area = 'chat' order by detail",
    [setup.account.accountId],
  );
  assert.deepEqual(
    costs.map(({ detail }) => detail),
    ["message", "pick"],
  );
});

test("a follow-up's picks go after the history, the earlier ones stay where they were, and an overview already read isn't sent again", async (t) => {
  const setup = await setUp(
    t,
    [
      { reply: { overviews: ["O1"] } },
      sectioned([{ heading: "One", points: [{ text: "First point.", sources: ["O1"] }] }]),
      { reply: { overviews: ["O1", "O2"] } },
      sectioned([{ heading: "Two", points: [{ text: "Second point.", sources: ["O2"] }] }]),
    ],
    { wholeCharacters: 10 },
  );
  await saved(setup, titled("First", "2026-11-01T09:00:00.000Z"), titled("Second", "2026-11-02T09:00:00.000Z"));
  const conversation = randomUUID();

  answeredOf(await setup.ask({ kind: "library" }, conversation, "Question one?"));
  const events = await setup.ask({ kind: "library" }, conversation, "Question two?");

  const [, firstAnswer, secondPick, secondAnswer] = setup.openAi.requests.map((request) => request.messages);
  assert.deepEqual(secondPick!.slice(0, firstAnswer!.length), firstAnswer);
  assert.equal(secondPick![firstAnswer!.length]!.role, "assistant");
  assert.deepEqual(secondAnswer!.slice(0, firstAnswer!.length + 1), secondPick!.slice(0, firstAnswer!.length + 1));
  const added = secondAnswer!.at(-2)!.content;
  assert.match(added, /^The full notes of the overviews you chose:\n\n## \[O2\]/);
  assert.doesNotMatch(added, /## \[O1\]/);
  assert.deepEqual(
    (events[1] as Extract<ChatStreamEvent, { type: "picked" }>).overviews.map(({ title }) => title),
    ["Second"],
  );
});

test("an empty reply fails, gives the question back and is logged as one", async (t) => {
  const setup = await setUp(t, [{ reply: { intro: "", sections: [], takeaway: "" } }]);
  await saved(setup, titled("Only", "2026-11-01T09:00:00.000Z"));

  const events = await setup.ask({ kind: "library" }, randomUUID(), "Anything?");

  assert.equal(events.at(-1)?.type, "failed");
  assert.equal(await usedThisMonth(setup), 0);
  assert.equal(setup.lines.find((line) => line["logCode"] === "api.chat.failed")?.["reason"], "EmptyAnswerError");
});

test("the routes ask over the library or a project, and refuse a project that isn't there or a library with nothing in it", async (t) => {
  const setup = await setUp(t, [sectioned([{ heading: "Scope", points: [{ text: "One.", sources: ["O1"] }] }])]);
  const library = (body: unknown) => setup.account.inject({ method: "POST", url: "/api/chats/library/messages", body });

  assert.equal((await library({ conversationId: randomUUID(), text: "Anything?" })).statusCode, 422);
  assert.equal(
    (
      await setup.account.inject({
        method: "POST",
        url: `/api/chats/projects/${randomUUID()}/messages`,
        body: { conversationId: randomUUID(), text: "Hi?" },
      })
    ).statusCode,
    404,
  );
  await saved(setup, titled("Only", "2026-11-01T09:00:00.000Z"));
  const response = await library({ conversationId: randomUUID(), text: "What's in here?" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /"type":"section"/);
  assert.match(response.body, /"type":"answered"/);
});
