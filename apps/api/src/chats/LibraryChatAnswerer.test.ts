import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CHAT_LIBRARY_RESERVE_UNITS,
  chatRecordId,
  chatUnitsOf,
  chatUsageAllowances,
  CURRENT_SCHEMA_VERSIONS,
  overviewPartHash,
  type ChatMessage,
  type ChatStreamEvent,
  type Overview,
  VideoId,
  youTubeSource,
} from "@overview/domain";
import { makeProject, makeStoredTranscript } from "@overview/store-conformance";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { noteAbout } from "../testing/meaningFixtures.testHelper.js";
import { storedTopic, UPDATED_AT } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { makeFakeChatOpenAi, type FakeChatAnswer, type FakeChatOpenAi } from "./FakeChatOpenAi.testHelper.js";
import type { ChatPlan } from "./planScope.js";
import { LibraryChatAnswerer, type LibraryChatOwner } from "./LibraryChatAnswerer.js";

interface Setup {
  testApp: TestApp;
  account: TestAccount;
  openAi: FakeChatOpenAi;
  lines: Array<Record<string, unknown>>;
  ask(
    owner: LibraryChatOwner,
    conversationId: string,
    text: string,
    extra?: { pins?: { overviews: string[]; projects: string[] }; setAside?: string[] },
  ): Promise<ChatStreamEvent[]>;
}

const setUp = async (t: TestContext, answers: FakeChatAnswer[], { wholeCharacters }: { wholeCharacters?: number } = {}): Promise<Setup> => {
  const openAi = makeFakeChatOpenAi(...answers);
  const testApp = await createTestApp(
    {},
    {
      ourKey: {
        apiKey: "sk-test-ours",
        dailyGenerations: 300,
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
    passages: new TranscriptPassagesRepository(testApp.sql),
    transcripts: new TranscriptsRepository(testApp.sql, () => testApp.clock.now),
    ...(wholeCharacters === undefined ? {} : { wholeCharacters }),
  });
  return {
    testApp,
    account,
    openAi,
    lines,
    ask: async (owner, conversationId, text, extra = {}) => {
      const events: ChatStreamEvent[] = [];
      for await (const event of await answerer.ask(
        { accountId: account.accountId, plan: "free" },
        owner,
        { conversationId, text, ...extra },
        logger,
      )) {
        events.push(event);
      }
      return events;
    },
  };
};

const titled = (title: string, savedAt: string, points = ["Start with one habit", "Charge from day one", "Keep it small"]): Overview => {
  const overview = noteAbout(`${title} claim`, points, { savedAt });
  return { ...overview, source: { ...overview.source, title } };
};

const saved = async (setup: Setup, ...overviews: Overview[]) => {
  for (const overview of overviews) {
    const response = await setup.account.inject({ method: "POST", url: "/api/overviews", body: overview });
    assert.equal(response.statusCode, 201, response.body);
  }
};

const projectOf = async (setup: Setup, overviews: Overview[], removed: Overview[] = []) => {
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
};

const ANY: ChatPlan["filters"] = { read: "any", favourite: "any", kinds: [], topics: [], savedFrom: "", savedTo: "", novelty: [] };
const planned = (picks: string[], extra: { filters?: Partial<ChatPlan["filters"]>; mode?: ChatPlan["mode"] } = {}): FakeChatAnswer => ({
  reply: { filters: { ...ANY, ...extra.filters }, mode: extra.mode ?? "deep", picks },
});

const sectioned = (sections: Array<{ heading: string; points: Array<{ text: string; sources: string[] }> }>) => ({
  reply: {
    intro: "Most of them start small.",
    introSources: [],
    sections: sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.points.map((point) => point.text),
      numbered: [],
      bullets: [],
      sources: section.points.flatMap((point) => point.sources.map((id) => ({ id, relation: "Supports" }))),
    })),
    takeaway: "Pick one habit.",
    inSource: false,
    generalKnowledge: false,
  },
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
  const [system, marks, question] = setup.openAi.requests[0]!.messages;
  assert.match(
    system!.content,
    /about one of their projects in The Overview, "Indie apps", which they keep for this: "Apps I can run alone", listed below in full/,
  );
  assert.match(
    system!.content,
    /## \[O1\]\n\nvideo · saved 2026-11-01[^\n]*\n\n# Cardstock[\s\S]*## \[O2\]\n\nvideo · saved 2026-11-02[^\n]*\n\n# Tiny SaaS/,
  );
  assert.match(system!.content, /\[O1\.kp1\] Start with one habit/);
  assert.doesNotMatch(system!.content, /Left out/);
  assert.deepEqual(marks, { role: "user", content: "The reader's marks. Unread: O1, O2.\nFavourites: none." });
  assert.deepEqual(question, { role: "user", content: "What do these share?" });
  assert.deepEqual(
    events.map((event) => event.type).filter((type, index, all) => all.indexOf(type) === index),
    ["text", "section", "answered"],
  );
  const section = events.find((event) => event.type === "section") as Extract<ChatStreamEvent, { type: "section" }>;
  assert.equal(section.section.paragraphs[0], "Begin with one habit.");

  const done = answeredOf(events);
  const answer = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    answer.sections?.sections[0]?.sources.map((source) => source.citation),
    [
      {
        overviewId: older.id,
        title: "Cardstock",
        item: { part: "keyPoint", index: 0, textHash: overviewPartHash("Start with one habit") },
      },
      { overviewId: newer.id, title: "Tiny SaaS", item: null },
    ],
  );
  assert.deepEqual(answer.stats, { overviews: 2, read: 2 });
  assert.equal(answer.inSource, false);
  assert.match(answer.text, /^Most of them start small\.\n\nScope\nBegin with one habit\.\n\nPick one habit\.$/);
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
      planned(["O1", "O3.kp2", "O7", "O1"]),
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
    looked: 3,
  });
  assert.deepEqual(events.filter((event) => event.type === "section").length, 2);
  const [pick, answer] = setup.openAi.requests.map((request) => request.messages);
  assert.match(pick![0]!.content, /listed below in brief[\s\S]*picks: up to 5 overviews/);
  assert.match(pick![0]!.content, /## \[O2\] Second\nvideo · saved 2026-11-02[^\n]*\nSecond claim/);
  assert.equal(pick![1]!.content, "The reader's marks. Unread: O1, O2, O3.\nFavourites: none.");
  assert.equal(pick!.at(-1)!.content, "Plan the answer to this question: What makes money?");
  assert.deepEqual(answer!.slice(0, 2), pick!.slice(0, 2));
  assert.match(answer![2]!.content, /^The full notes of the overviews you chose:\n\n## \[O1\]\n\n# First[\s\S]*## \[O3\]\n\n# Third/);
  assert.doesNotMatch(answer![2]!.content, /# Second/);
  assert.deepEqual(answer![3], { role: "user", content: "What makes money?" });

  const done = answeredOf(events);
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    reply.sections!.sections.flatMap((section) =>
      section.sources.flatMap(({ citation }) => ("overviewId" in citation ? [[citation.title, citation.item?.index ?? null]] : [])),
    ),
    [
      ["First", 1],
      ["Second", null],
      ["Third", null],
      ["Third", 2],
    ],
  );
  assert.deepEqual(reply.stats, { overviews: 3, projects: 1, read: 2, looked: 3 });
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
      planned(["O1"]),
      sectioned([{ heading: "One", points: [{ text: "First point.", sources: ["O1"] }] }]),
      planned(["O1", "O2"]),
      sectioned([{ heading: "Two", points: [{ text: "Second point.", sources: ["O2"] }] }]),
    ],
    { wholeCharacters: 10 },
  );
  await saved(setup, titled("First", "2026-11-01T09:00:00.000Z"), titled("Second", "2026-11-02T09:00:00.000Z"));
  const conversation = randomUUID();

  answeredOf(await setup.ask({ kind: "library" }, conversation, "Question one?"));
  const events = await setup.ask({ kind: "library" }, conversation, "Question two?");

  const [, firstAnswer, secondPick, secondAnswer] = setup.openAi.requests.map((request) => request.messages);
  const [system, , firstPicks, firstQuestion] = firstAnswer!;
  assert.deepEqual(secondPick!.slice(0, 3), [system, firstPicks, firstQuestion]);
  assert.equal(secondPick![3]!.role, "assistant");
  assert.match(secondPick![4]!.content, /^The reader's marks\./);
  assert.deepEqual(secondAnswer!.slice(0, 5), secondPick!.slice(0, 5));
  const added = secondAnswer!.at(-2)!.content;
  assert.match(added, /^The full notes of the overviews you chose:\n\n## \[O2\]/);
  assert.doesNotMatch(added, /## \[O1\]/);
  assert.deepEqual(
    (events[1] as Extract<ChatStreamEvent, { type: "picked" }>).overviews.map(({ title }) => title),
    ["Second"],
  );
});

test("an empty reply fails, gives the question back and is logged as one", async (t) => {
  const setup = await setUp(t, [
    { reply: { intro: "", introSources: [], sections: [], takeaway: "", inSource: false, generalKnowledge: false } },
  ]);
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

test("near the end of the month a library question is refused while there's room for an overview question, and says so (OV-376)", async (t) => {
  const setup = await setUp(t, [sectioned([{ heading: "Scope", points: [{ text: "One.", sources: ["O1"] }] }])]);
  await saved(setup, titled("Only", "2026-11-01T09:00:00.000Z"));
  const today = setup.testApp.clock.now.toISOString().slice(0, 10);
  await setup.testApp.sql.query("insert into chat_usage (day, account_id, messages, units) values ($1::date, $2, 90, $3)", [
    today,
    setup.account.accountId,
    chatUsageAllowances.free - CHAT_LIBRARY_RESERVE_UNITS + 1,
  ]);

  const refused = await setup.account.inject({
    method: "POST",
    url: "/api/chats/library/messages",
    body: { conversationId: randomUUID(), text: "What's in here?" },
  });

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "chat-month");
  assert.equal(refused.json().error.details.scope, "library");
  assert.equal(setup.openAi.requests.length, 0);
  const usage = (await setup.account.inject({ method: "GET", url: "/api/chat-usage" })).json() as { share: number; libraryFits: boolean };
  assert.equal(usage.libraryFits, false);
  assert.ok(usage.share < 1);
});

test("a large project's chat also sends the best minutes of its members' transcripts, and a point cites one as a time (OV-352)", async (t) => {
  const setup = await setUp(
    t,
    [planned(["O1"]), sectioned([{ heading: "Dose", points: [{ text: "Three hundred milligrams.", sources: ["O2.p2", "O2.p9"] }] }])],
    { wholeCharacters: 10 },
  );
  const stored = makeStoredTranscript({
    videoId: VideoId.parse(randomUUID().slice(0, 11)),
    segments: [
      { text: "Welcome.", startMs: 0, endMs: 50_000 },
      { text: "Take 300 milligrams of ashwagandha before bed.", startMs: 60_000, endMs: 110_000 },
    ],
  });
  const first = titled("First", "2026-11-01T09:00:00.000Z");
  const withWords = { ...titled("Sleep", "2026-11-02T09:00:00.000Z"), source: { ...youTubeSource(stored.video!), title: "Sleep" } };
  const outside = titled("Outside", "2026-11-03T09:00:00.000Z");
  await saved(setup, first, withWords, outside);
  assert.equal((await setup.account.inject({ method: "PUT", url: `/api/transcripts/${stored.videoId}`, body: stored })).statusCode, 204);
  const project = await projectOf(setup, [first, withWords]);

  const events = await setup.ask({ kind: "project", id: project.id }, randomUUID(), "How much ashwagandha?");

  const answer = setup.openAi.requests[1]!.messages;
  const minutes = answer.at(-2)!.content;
  assert.match(minutes, /^Minutes of their transcripts that match the question's words/);
  assert.match(minutes, /## \[O2\] Sleep\n\n\[O2\.p1 0:00\] Welcome\.\n\[O2\.p2 1:00\] Take 300 milligrams of ashwagandha before bed\./);
  const done = answeredOf(events);
  assert.deepEqual((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).minutes, [
    { overviewId: withWords.id, passages: ["p1", "p2"] },
  ]);
  const reply = done.messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    reply.sections!.sections[0]!.sources.map((source) => source.citation),
    [{ overviewId: withWords.id, title: "Sleep", item: null, range: { startMs: 60_000, endMs: 110_000 } }],
  );
});

test("an overview pinned from outside the project is read whole with the question under its own label, and setting it aside says so (OV-354)", async (t) => {
  const setup = await setUp(t, [
    sectioned([{ heading: "Scope", points: [{ text: "Bake slowly.", sources: ["O2.kp1"] }] }]),
    sectioned([{ heading: "Scope", points: [{ text: "Start small.", sources: ["O2", "O1"] }] }]),
  ]);
  const member = titled("Member", "2026-11-01T09:00:00.000Z");
  const outside = titled("Sourdough", "2026-11-02T09:00:00.000Z", ["Feed the starter", "Keep it warm", "Bake in a pot"]);
  await saved(setup, member, outside);
  const project = await projectOf(setup, [member]);
  const conversation = randomUUID();

  const first = await setup.ask({ kind: "project", id: project.id }, conversation, "How do I start?", {
    pins: { overviews: [outside.id], projects: [] },
  });
  const second = await setup.ask({ kind: "project", id: project.id }, conversation, "And now?", { setAside: [outside.id] });

  const [asked] = setup.openAi.requests.map((request) => request.messages);
  assert.match(asked!.at(-2)!.content, /^The full notes of the overviews you chose:\n\n## \[O2\]\n\n# Sourdough/);
  const done = answeredOf(first);
  assert.deepEqual((done.messages[0] as Extract<ChatMessage, { from: "reader" }>).sources, [
    { label: "S1", overviewId: outside.id, title: "Sourdough", how: "pinned" },
  ]);
  assert.deepEqual(
    (done.messages[1] as Extract<ChatMessage, { from: "answer" }>).sections!.sections[0]!.sources.map(({ citation }) =>
      "overviewId" in citation ? citation.item?.index : null,
    ),
    [0],
  );
  const later = setup.openAi.requests[1]!.messages;
  assert.equal(later.at(-2)!.content, 'The reader set aside "Sourdough" from this conversation. Don\'t use or cite it from here on.');
  const reply = answeredOf(second).messages[1] as Extract<ChatMessage, { from: "answer" }>;
  assert.deepEqual(
    reply.sections!.sections[0]!.sources.map(({ citation }) => ("overviewId" in citation ? citation.title : null)),
    ["Member"],
  );
});

test("a plan's filters keep the scope by code: the marks and topics are sent, picks outside it are dropped, and a broad answer gets room (OV-373)", async (t) => {
  const setup = await setUp(
    t,
    [
      planned(["O2", "O1", "O3"], { filters: { read: "unread", topics: ["Health", "Gardening"], savedFrom: "soon" }, mode: "broad" }),
      sectioned([{ heading: "Read first", points: [{ text: "Both of these.", sources: ["O2", "O3", "O1"] }] }]),
    ],
    { wholeCharacters: 10 },
  );
  const topic = storedTopic({ name: "Health" });
  const posted = await setup.account.inject({ method: "POST", url: "/api/topics", body: topic });
  assert.equal(posted.statusCode, 201, posted.body);
  const onTopic = (overview: Overview): Overview => ({ ...overview, topicIds: [topic.id as Overview["topicIds"][number]] });
  const overviews = [
    onTopic(titled("Read already", "2026-11-01T09:00:00.000Z")),
    onTopic(titled("Sleep", "2026-11-02T09:00:00.000Z")),
    onTopic(titled("Stress", "2026-11-03T09:00:00.000Z")),
    titled("Off topic", "2026-11-04T09:00:00.000Z"),
  ];
  await saved(setup, ...overviews);
  const marked = await setup.account.inject({
    method: "PUT",
    url: `/api/overviews/${overviews[0]!.id}/state`,
    body: { read: true, favourite: true, updatedAt: UPDATED_AT },
  });
  assert.ok(marked.statusCode < 300, marked.body);

  const events = await setup.ask({ kind: "library" }, randomUUID(), "What's worth reading first in my unread health overviews?");

  const [plan, answer] = setup.openAi.requests.map((request) => request.messages);
  assert.match(plan![0]!.content, /# Topics\n\nHealth\n/);
  assert.match(plan![0]!.content, /## \[O2\] Sleep\nvideo · saved 2026-11-02 · [^\n]*topics: Health\n/);
  assert.equal(plan![1]!.content, "The reader's marks. Unread: O2, O3, O4.\nFavourites: O1.");
  assert.deepEqual(events[1], {
    type: "picked",
    overviews: [
      { overviewId: overviews[1]!.id, title: "Sleep" },
      { overviewId: overviews[2]!.id, title: "Stress" },
    ],
    looked: 2,
  });
  assert.deepEqual(
    setup.openAi.requests.map((request) => request.maxTokens),
    [3_000, 16_000],
  );
  assert.equal(
    answer![2]!.content,
    "The overviews code kept after your filters: O2, O3. Answer from these alone. This answer is broad: put every one of these in the sources of a list item, not only the ones read in full. Group those that share a reason.",
  );
  assert.match(answer![3]!.content, /^The full notes of the overviews you chose:\n\n## \[O2\][\s\S]*## \[O3\]/);
  const done = answeredOf(events);
  assert.deepEqual((done.messages[1] as Extract<ChatMessage, { from: "answer" }>).stats, {
    overviews: 4,
    projects: 0,
    read: 2,
    looked: 2,
  });
  const line = setup.lines.find((each) => each["logCode"] === "api.chat.answered")!;
  assert.deepEqual([line["answerMode"], line["filtered"], line["lookedAcross"], line["scopeCited"]], ["broad", true, 2, 2]);
  assert.equal(line["usageUnits"], chatUnitsOf(line["costDollars"] as number));
  const [spent] = await setup.testApp.sql.query<{ units: string; library: string }>(
    "select sum(units) as units, sum(library_units) as library from chat_usage",
  );
  assert.equal(Number(spent?.library), Number(spent?.units));
});

test("a small library that goes whole sends the marks and leaves room for an answer that covers every overview (OV-373)", async (t) => {
  const setup = await setUp(t, [sectioned([{ heading: "All", points: [{ text: "Both.", sources: ["O1", "O2"] }] }])]);
  await saved(setup, titled("One", "2026-11-01T09:00:00.000Z"), titled("Two", "2026-11-02T09:00:00.000Z"));

  const events = await setup.ask({ kind: "library" }, randomUUID(), "Sort everything I saved.");

  assert.equal(setup.openAi.requests.length, 1);
  assert.equal(setup.openAi.requests[0]!.messages[1]!.content, "The reader's marks. Unread: O1, O2.\nFavourites: none.");
  assert.equal(setup.openAi.requests[0]!.maxTokens, 16_000);
  assert.equal(setup.openAi.requests[0]!.messages.length, 3);
  assert.equal(
    events.some((event) => event.type === "picking"),
    false,
  );
});

test("a broad answer over the whole map, unfiltered, is told by code to place every overview, not only the ones read in full (OV-373)", async (t) => {
  const setup = await setUp(
    t,
    [planned(["O2"], { mode: "broad" }), sectioned([{ heading: "All", points: [{ text: "Each.", sources: ["O1", "O2", "O3"] }] }])],
    { wholeCharacters: 10 },
  );
  await saved(
    setup,
    titled("First", "2026-11-01T09:00:00.000Z"),
    titled("Second", "2026-11-02T09:00:00.000Z"),
    titled("Third", "2026-11-03T09:00:00.000Z"),
  );

  await setup.ask({ kind: "library" }, randomUUID(), "Rank everything I saved.");

  const answer = setup.openAi.requests[1]!;
  assert.equal(answer.maxTokens, 16_000);
  assert.equal(
    answer.messages[2]!.content,
    "This answer is broad: put every one of the overviews in the sources of a list item, not only the ones read in full. Group those that share a reason.",
  );
  assert.match(answer.messages[3]!.content, /^The full notes of the overviews you chose:\n\n## \[O2\]/);
});
