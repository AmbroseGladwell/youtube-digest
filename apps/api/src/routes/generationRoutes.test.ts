import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_OVERVIEWS, TRIAL_TOKEN_HEADER } from "@overview/domain";
import { generationRequest, makeFakeOpenAi, type FakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { ourKeyModel } from "../generation/ourKeyModel.js";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";
import { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { TRIAL_OVERVIEWS_PER_ADDRESS_DAILY, TrialsRepository } from "../usage/TrialsRepository.js";

const OUR_KEY = "sk-test-ours";

async function ourKeyApp(
  openAi: FakeOpenAi,
  {
    dailyGenerations = 300,
    signedOutDailyGenerations = 50,
    logger,
  }: { dailyGenerations?: number; signedOutDailyGenerations?: number; logger?: ReturnType<typeof recordingLogger>["logger"] } = {},
) {
  return createTestApp(
    {},
    {
      ourKey: { apiKey: OUR_KEY, dailyGenerations, signedOutDailyGenerations, http: openAi.http },
      ...(logger === undefined ? {} : { logger }),
    },
  );
}

const generate = (account: TestAccount) =>
  account.inject({ method: "POST", url: "/api/generations", body: generationRequest(randomUUID()) });

const usageOf = async (account: TestAccount) => (await account.inject({ method: "GET", url: "/api/overview-usage" })).json();

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a signed-in reader with no key gets an overview made on our key with Sol, and it counts once on our key", async () => {
  const openAi = makeFakeOpenAi();
  const testApp = await ourKeyApp(openAi);
  const account = await makeAccount(testApp);
  const request = generationRequest(randomUUID());

  const response = await account.inject({ method: "POST", url: "/api/generations", body: request });
  const usage = await usageOf(account);

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, request.overviewId);
  assert.equal(response.json().inOneLine, "A short description.");
  assert.deepEqual(
    openAi.requests.map((sent) => [sent.model, sent.authorization]),
    [[ourKeyModel.model, `Bearer ${OUR_KEY}`]],
  );
  assert.deepEqual([usage.ours.used, usage.own.used], [1, 0]);
  await testApp.close();
});

test("an article is made on our key from what the reader's browser read, and counts as one overview", async () => {
  const note = {
    inOneLine: "A reported piece on one town's repair bill.",
    coreClaim: "The repair bill doubled because a survey was never checked.",
    thin: false,
    keyPoints: [
      { text: "The bridge closed in March.", paragraphIndex: 0 },
      { text: "The county offered half.", paragraphIndex: 2 },
      { text: "Residents pay the rest.", paragraphIndex: 3 },
    ],
    chapters: [
      { title: "The closure", summary: "Why the bridge shut.", startParagraphIndex: 0 },
      { title: "Who pays", summary: "How the bill is split.", startParagraphIndex: 2 },
    ],
    matchedTopicNames: [],
    suggestedTopic: null,
    recipe: null,
    tags: ["bridges", "local-news", "budgets"],
    howToApply: { items: [] },
    readAnyway: { answer: "no", reason: "This carries it.", leftOut: "It leaves out the council meeting.", chapterIndexes: [] },
  };
  const openAi = makeFakeOpenAi({ status: 200, body: { choices: [{ message: { content: JSON.stringify(note) } }], usage: {} } });
  const testApp = await ourKeyApp(openAi);
  const account = await makeAccount(testApp);
  const { overviewId, input } = generationRequest(randomUUID());
  const { video: _video, transcript: _transcript, ...reader } = input as Record<string, unknown>;
  const article = {
    url: "https://news.example.com/bridge",
    title: "Bridge repairs cost twice the plan",
    siteName: "Example News",
    author: null,
    publishedAt: null,
    language: "en",
    imageUrl: null,
    sections: [
      {
        heading: null,
        anchor: null,
        text: "The bridge has been closed since March because of cracks.\n\nThe council met for three hours on Tuesday.",
      },
      {
        heading: "Who pays",
        anchor: "who-pays",
        text: "The county offered half of the bill to the town.\n\nResidents will cover the rest through higher rates.",
      },
    ],
    wordCount: 500,
  };

  const response = await account.inject({ method: "POST", url: "/api/generations", body: { overviewId, input: { ...reader, article } } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().source.kind, "web");
  assert.equal(response.json().article.chapters[1].place.anchor, "who-pays");
  assert.equal((await usageOf(account)).ours.used, 1);
  await testApp.close();
});

test("regenerating counts again, because it costs the same again", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const account = await makeAccount(testApp);
  const request = generationRequest(randomUUID());

  await account.inject({ method: "POST", url: "/api/generations", body: request });
  await account.inject({ method: "POST", url: "/api/generations", body: request });

  assert.equal((await usageOf(account)).ours.used, 2);
  await testApp.close();
});

test("the 6th on our key in a month on Free is refused with which quota and the reset date", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const account = await makeAccount(testApp);
  for (let made = 0; made < overviewQuotas.free.ours; made += 1) await generate(account);

  const sixth = await generate(account);

  assert.equal(sixth.statusCode, 429);
  assert.equal(sixth.json().error.code, "too_many_requests");
  assert.deepEqual(
    { quota: sixth.json().error.details.quota, resetsOn: sixth.json().error.details.resetsOn },
    { quota: "ours", resetsOn: "2026-10-01" },
  );
  assert.ok(Number(sixth.headers["retry-after"]) > 0);
  await testApp.close();
});

test("a failed generation gives back both its month's slot and its day's slot", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi({ status: 503, body: { error: { message: "overloaded" } } }));
  const account = await makeAccount(testApp);

  const response = await generate(account);

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, "generation_failed");
  assert.equal((await usageOf(account)).ours.used, 0);
  assert.equal(await new OverviewUsageRepository(testApp.sql).ourKeyGenerationsOn(usageDay(testApp.clock.now)), 0);
  await testApp.close();
});

test("each failure says whether it may move to the next key", async () => {
  const cases = [
    [{ status: 503, body: { error: { message: "overloaded" } } }, "provider-down"],
    [{ status: 429, body: { error: { type: "insufficient_quota", code: "insufficient_quota" } } }, "out-of-credit"],
    ["invalid", "schema-failure"],
    [{ status: 400, body: { error: { message: "bad request" } } }, null],
  ] as const;
  for (const [answer, fallback] of cases) {
    const testApp = await ourKeyApp(makeFakeOpenAi(answer));
    const account = await makeAccount(testApp);

    const response = await generate(account);

    assert.equal(response.json().error.details.fallback, fallback, JSON.stringify(answer));
    await testApp.close();
  }
});

test("our own key refused by OpenAI is ours to fix: the reader is told it's unavailable and nothing counts", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi({ status: 401, body: { error: { message: "Incorrect API key" } } }), { logger });
  const account = await makeAccount(testApp);

  const response = await generate(account);

  assert.equal(response.json().error.code, "unavailable");
  assert.equal((await usageOf(account)).ours.used, 0);
  assert.equal(saying(lines, "our key refused").length, 1);
  await testApp.close();
});

test("the global daily cap refuses every plan once spent, and turns with the UTC day", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi(), { dailyGenerations: 1 });
  const first = await makeAccount(testApp);
  const second = await makeAccount(testApp);
  await generate(first);

  const refused = await generate(second);
  const usedWhenRefused = (await usageOf(second)).ours.used;
  testApp.clock.advance(24 * 60 * 60 * 1000);
  const nextDay = await generate(second);

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "our-key-daily");
  assert.equal(usedWhenRefused, 0);
  assert.equal(nextDay.statusCode, 200);
  await testApp.close();
});

test("a generation logs its tokens and cost, measured from what OpenAI reported", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  const account = await makeAccount(testApp);

  await generate(account);
  const [made] = saying(lines, "overview made on our key");

  assert.equal(made?.plan, "free");
  assert.equal(made?.model, ourKeyModel.model);
  assert.deepEqual([made?.inputTokens, made?.outputTokens], [1200, 300]);
  assert.equal(made?.costDollars, (1000 * 2 + 200 * 0.1 + 300 * 10) / 1_000_000);
  await testApp.close();
});

test("a server with a key of its own says which provider and model it makes overviews with", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());

  const status = await testApp.app.inject({
    method: "GET",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.deepEqual(status.json(), { available: true, provider: ourKeyModel.provider, model: ourKeyModel.model });
  await testApp.close();
});

test("a server with no key of its own says so before anyone asks it to generate", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const status = await testApp.app.inject({
    method: "GET",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });
  const refused = await generate(account);

  assert.deepEqual(status.json(), { available: false });
  assert.equal(refused.json().error.code, "unavailable");
  await testApp.close();
});

test("making an overview on our key needs an account or a trial", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: generationRequest(randomUUID()),
  });

  assert.equal(response.json().error.code, "unauthenticated");
  await testApp.close();
});

const DAY_MS = 24 * 60 * 60 * 1000;

test("signed out, a device makes its one onboarding overview on our key on its token, and the next is refused as the trial's", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const device = await makeTrialDevice(testApp);

  const made = [];
  for (let n = 0; n < TRIAL_OVERVIEWS; n += 1) made.push((await device.generate()).statusCode);
  const next = await device.generate();

  assert.deepEqual(made, [200]);
  assert.equal(next.statusCode, 429);
  assert.equal(next.json().error.details.quota, "trial");
  await testApp.close();
});

test("a new token from the same address gets no more on our key that day, while another address does", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  for (let n = 0; n < TRIAL_OVERVIEWS_PER_ADDRESS_DAILY; n += 1) await (await makeTrialDevice(testApp)).generate();

  const privateWindow = await makeTrialDevice(testApp);
  const refused = await privateWindow.generate();
  const elsewhere = await (await makeTrialDevice(testApp, "198.51.100.4")).generate();
  testApp.clock.advance(DAY_MS);
  const tomorrow = await privateWindow.generate();

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "trial-address");
  assert.ok(Number(refused.headers["retry-after"]) > 0);
  assert.equal(elsewhere.statusCode, 200);
  assert.equal(tomorrow.statusCode, 200);
  assert.equal(saying(lines, "trial address cap spent").length, 1);
  assert.ok(!JSON.stringify(lines).includes("203.0.113.7"));
  await testApp.close();
});

test("a refusal from the address doesn't spend the token's own trial", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  for (let n = 0; n < TRIAL_OVERVIEWS_PER_ADDRESS_DAILY; n += 1) await (await makeTrialDevice(testApp)).generate();
  const device = await makeTrialDevice(testApp);
  await device.generate();

  testApp.clock.advance(DAY_MS);
  const made = [];
  for (let n = 0; n < TRIAL_OVERVIEWS; n += 1) made.push((await device.generate()).statusCode);

  assert.deepEqual(made, [200]);
  await testApp.close();
});

test("once the signed-out share of the day is spent, a trial is refused as busy while an account still makes one", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { signedOutDailyGenerations: 1, logger });
  await (await makeTrialDevice(testApp)).generate();

  const refused = await (await makeTrialDevice(testApp, "198.51.100.4")).generate();
  const account = await generate(await makeAccount(testApp));

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "our-key-daily");
  assert.equal(account.statusCode, 200);
  assert.equal(saying(lines, "our key signed-out share spent").length, 1);
  await testApp.close();
});

test("a failed trial generation gives back its token's slot, its address's and the signed-out share", async () => {
  const openAi = makeFakeOpenAi({ status: 503, body: { error: { message: "overloaded" } } });
  const testApp = await ourKeyApp(openAi, { signedOutDailyGenerations: 1 });
  const device = await makeTrialDevice(testApp);

  for (let n = 0; n < TRIAL_OVERVIEWS + 1; n += 1) await device.generate();
  const usage = new OverviewUsageRepository(testApp.sql);
  const day = usageDay(testApp.clock.now);

  assert.equal((await device.generate()).json().error.code, "generation_failed");
  assert.deepEqual([await usage.ourKeyGenerationsOn(day), await usage.signedOutGenerationsOn(day)], [0, 0]);
  await testApp.close();
});

test("a token this server never issued is told so, so the device can ask for a new one", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), [TRIAL_TOKEN_HEADER]: "never-issued" },
    payload: generationRequest(randomUUID()),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.details.trial, "unknown");
  assert.equal(await new OverviewUsageRepository(testApp.sql).ourKeyGenerationsOn(usageDay(testApp.clock.now)), 0);
  await testApp.close();
});

test("a trial overview logs as the trial's, with the token's count", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  const device = await makeTrialDevice(testApp);

  await device.generate();
  const [made] = saying(lines, "overview made on our key");

  assert.deepEqual([made?.caller, made?.plan, made?.used, made?.limit], ["trial", null, 1, TRIAL_OVERVIEWS]);
  assert.equal(saying(lines, "trial token issued").length, 1);
  assert.ok(!JSON.stringify(lines).includes(device.token));
  await testApp.close();
});

test("a server with no key of its own issues no trials", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/trials",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.equal(response.json().error.code, "unavailable");
  await testApp.close();
});

const PROFILE_PASS = {
  sentence: "I'm a dad.",
  learned: [],
  removed: [],
  overviews: [
    { title: "One", premise: "A premise.", topics: ["Startups"], captureReason: null },
    { title: "Two", premise: "A premise.", topics: ["Startups"], captureReason: null },
  ],
};
const profileAnswer = {
  status: 200,
  body: {
    choices: [{ message: { content: JSON.stringify({ items: [{ text: "building a startup", overviewIndices: [0, 1] }] }) } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 0 } },
  },
};

test("a profile pass answers on our key without counting against the plan or the day", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi(profileAnswer, "valid"), { dailyGenerations: 1 });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/generations/profile", body: PROFILE_PASS });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { items: [{ text: "building a startup", source: "From 2 overviews on startups" }] });
  assert.equal((await usageOf(account)).ours.used, 0);
  assert.equal((await generate(account)).statusCode, 200);
});

test("a profile pass needs an account", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi(profileAnswer));

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/generations/profile",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    body: PROFILE_PASS,
  });

  assert.equal(response.statusCode, 401);
});

test("How to apply for anyone answers on our key without counting against the plan", async () => {
  const answer = {
    status: 200,
    body: {
      choices: [{ message: { content: JSON.stringify({ items: ["Practise on one onion."] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 0 } },
    },
  };
  const testApp = await ourKeyApp(makeFakeOpenAi(answer));
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/generations/how-to-apply",
    body: { title: "T", channel: "C", inOneLine: "L", coreClaim: "C", keyPoints: ["K"] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { items: ["Practise on one onion."] });
  assert.equal((await usageOf(account)).ours.used, 0);
});

test("a sample is sorted into the reader's own topics on our key, without counting against the plan", async () => {
  const answer = {
    status: 200,
    body: {
      choices: [{ message: { content: JSON.stringify({ matchedTopicNames: ["Health"] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 0 } },
    },
  };
  const testApp = await ourKeyApp(makeFakeOpenAi(answer));
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/generations/topics",
    body: {
      title: "T",
      source: "S",
      inOneLine: "L",
      keyPoints: ["K"],
      topics: [
        { name: "Health", description: "Sleep and the body." },
        { name: "Food", description: null },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { names: ["Health"] });
  assert.equal((await usageOf(account)).ours.used, 0);
});

test("sorting into topics needs some topics to sort into", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi({ status: 200, body: {} }));
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/generations/topics",
    body: { title: "T", source: "S", inOneLine: "L", keyPoints: [], topics: [] },
  });

  assert.equal(response.statusCode, 400);
});

const suggestionAnswer = {
  status: 200,
  body: {
    choices: [{ message: { content: JSON.stringify({ starterTopicNames: ["Food"], newTopicName: "Knife skills" }) } }],
    usage: { prompt_tokens: 300, completion_tokens: 12, prompt_tokens_details: { cached_tokens: 0 } },
  },
};

test("signed out, onboarding has topics suggested on its trial, and its one overview is still there to make", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(suggestionAnswer), { logger });
  const device = await makeTrialDevice(testApp);

  const response = await device.suggestTopics();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { starter: ["Food"], newTopic: "Knife skills" });
  assert.equal(saying(lines, "small pass on our key").at(0)?.pass, "topicSuggestions");
  assert.equal(await new TrialsRepository(testApp.sql).used(device.token), 0);
  await testApp.close();
});

test("topic suggestions need a trial the server issued, or an account", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(suggestionAnswer), { logger });
  const ask = (headers: Record<string, string>) =>
    testApp.app.inject({
      method: "POST",
      url: "/api/generations/topic-suggestions",
      headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), ...headers },
      payload: { title: "T", kind: "article", text: "" },
    });

  assert.equal((await ask({})).statusCode, 401);
  const unknown = await ask({ [TRIAL_TOKEN_HEADER]: "never-issued" });
  assert.equal(unknown.statusCode, 401);
  assert.equal(unknown.json().error.details.trial, "unknown");
  assert.equal(saying(lines, "topic suggestions refused for an unknown trial").length, 1);
  assert.doesNotMatch(JSON.stringify(saying(lines, "topic suggestions refused for an unknown trial")), /never-issued/);
  const account = await makeAccount(testApp);
  const signedIn = await account.inject({
    method: "POST",
    url: "/api/generations/topic-suggestions",
    body: { title: "T", kind: "article", text: "" },
  });
  assert.equal(signedIn.statusCode, 200);
  await testApp.close();
});

test("a trial has a few topic suggestions a day, and an address a few more across its tokens", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi(suggestionAnswer));
  const first = await makeTrialDevice(testApp);
  const answered = [];
  for (let n = 0; n < 6; n += 1) answered.push((await first.suggestTopics()).statusCode);
  assert.deepEqual(answered, [200, 200, 200, 200, 200, 429]);

  for (let n = 0; n < 3; n += 1) {
    const another = await makeTrialDevice(testApp);
    for (let m = 0; m < 5; m += 1) assert.equal((await another.suggestTopics()).statusCode, 200);
  }
  const privateWindow = await makeTrialDevice(testApp);
  assert.equal((await privateWindow.suggestTopics()).statusCode, 429);
  const elsewhere = await makeTrialDevice(testApp, "198.51.100.4");
  assert.equal((await elsewhere.suggestTopics()).statusCode, 200);
  await testApp.close();
});
