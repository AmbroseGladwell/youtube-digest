import { makeFakeClaude, type FakeClaude } from "./FakeClaude.testHelper.js";
import assert from "node:assert/strict";
import type { FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, TopicId, type Overview, type Plan, type SuggestedQuestionScope } from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { makeFakeChatOpenAi, type FakeChatOpenAi } from "../chats/FakeChatOpenAi.testHelper.js";
import type { PromptMessage } from "../chats/streamChatCompletion.js";
import { makeConceptEmbedder } from "../meaning/ConceptEmbedder.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { distinctVideo, storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

export const REAL_TENSION = { relation: "different_view", verdict: "real", reason: "One says rest first; the other says routine first." };
export const DAY_MS = 24 * 60 * 60 * 1000;

export const SLEEP_TOPIC = TopicId.parse(randomUUID());
export const HABIT_TOPIC = TopicId.parse(randomUUID());

export const questionConcepts = () =>
  makeConceptEmbedder([
    ["sleep", "rest", "nap", "bedtime", "tired"],
    ["sourdough", "loaf", "dough", "starter", "proving"],
    ["founders", "leaders", "succession", "control"],
    ["habit", "routine", "streak", "cue"],
  ]);

export interface RefreshSetting {
  testApp: TestApp;
  account: TestAccount;
  labeller: FakeChatOpenAi;
  writer: FakeClaude;
  labelled: () => string[];
  written: () => PromptMessage[][];
  save: (title: string, coreClaim: string, points: string[], overrides?: Partial<Overview>) => Promise<string>;
  saveOverview: (overview: ReturnType<typeof noteTitled>) => Promise<string>;
  project: (memberIds: string[]) => Promise<string>;
  refresh: (scope: SuggestedQuestionScope) => Promise<{ status: string }>;
  setPlan: (plan: Plan) => Promise<void>;
  advanceDays: (days: number) => void;
}

const KEY_POINTS_MIN = 3;

// One made-up word, so a filler point lands near nothing.
const unrelatedWord = () =>
  randomUUID()
    .replace(/-/g, "")
    .replace(/\d/g, (digit) => "ghijklmnop"[Number(digit)]!);

export const noteTitled = (title: string, coreClaim: string, points: string[], overrides: Partial<Overview> = {}) =>
  storedOverview({
    source: { ...distinctVideo(), title },
    coreClaim,
    keyPoints: [...points, ...Array.from({ length: Math.max(0, KEY_POINTS_MIN - points.length) }, unrelatedWord)].map((text) => ({
      text,
      range: null,
    })),
    ...overrides,
  });

export interface RefreshSetUp {
  writerReply?: unknown;
  plan?: Plan;
  logger?: FastifyBaseLogger;
  answersAfter?: Promise<void>;
}

export const setUpRefresh = async (
  t: { after: (fn: () => Promise<void>) => void },
  { writerReply = { questions: [] }, plan = "plus", logger, answersAfter = Promise.resolve() }: RefreshSetUp = {},
): Promise<RefreshSetting> => {
  const labeller = makeFakeChatOpenAi({ reply: REAL_TENSION });
  const writer = makeFakeClaude({ reply: writerReply });
  const http = (async (url: string | URL | Request, init: RequestInit = {}) => {
    await answersAfter;
    return (String(url).includes("anthropic.com") ? writer : labeller).http(url, init);
  }) as typeof fetch;
  const testApp = await createTestApp(
    {},
    {
      embedder: questionConcepts(),
      ourKey: { apiKey: "sk-test-ours", anthropicApiKey: "sk-ant-test-ours", dailyGenerations: 300, dailyChatMessages: 100, http },
      ...(logger === undefined ? {} : { logger }),
    },
  );
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const setPlan = async (next: Plan) => {
    await testApp.sql.query("update accounts set plan = $2 where id = $1", [account.accountId, next]);
  };
  await setPlan(plan);
  const saveOverview = async (overview: ReturnType<typeof noteTitled>) => {
    const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
    assert.equal(response.statusCode, 201, response.body);
    await testApp.drainEmbeddings();
    return overview.id as string;
  };
  return {
    testApp,
    account,
    labeller,
    writer,
    labelled: () => labeller.requests.map((request) => request.messages[1]!.content),
    written: () => writer.requests.map((request) => request.messages),
    saveOverview,
    save: (title, coreClaim, points, overrides) => saveOverview(noteTitled(title, coreClaim, points, overrides)),
    project: async (memberIds) => {
      const made = { ...makeProject(), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT };
      assert.equal((await account.inject({ method: "POST", url: "/api/projects", body: made })).statusCode, 201);
      for (const overviewId of memberIds) {
        const added = await account.inject({
          method: "PUT",
          url: `/api/projects/${made.id}/members/${overviewId}`,
          body: { addedAt: UPDATED_AT, updatedAt: UPDATED_AT },
        });
        assert.equal(added.statusCode, 200, added.body);
      }
      return made.id;
    },
    refresh: async (scope) => {
      const response = await account.inject({ method: "POST", url: "/api/suggested-questions/refresh", body: { scope } });
      assert.equal(response.statusCode, 202, response.body);
      return response.json();
    },
    setPlan,
    advanceDays: (days) => testApp.clock.advance(days * DAY_MS),
  };
};

export interface SmallLibrary {
  newest: string;
  sameTopic: string;
  otherTopic: string;
  linked: string;
  founders: string;
}

// Newest first by savedAt; the newest names the bread note in similarTo, though their ideas never meet.
export const saveSmallLibrary = async ({ saveOverview }: Pick<RefreshSetting, "saveOverview">): Promise<SmallLibrary> => {
  const linkedNote = noteTitled("Slow bread", "Sourdough loaf needs slow proving", ["Feed the starter"], {
    savedAt: "2026-09-10T09:00:00.000Z",
  });
  const linked = await saveOverview(linkedNote);
  const founders = await saveOverview(
    noteTitled("Founders", "Founders clinging to control stall growth", ["Succession is avoided"], { savedAt: "2026-09-05T09:00:00.000Z" }),
  );
  const otherTopic = await saveOverview(
    noteTitled("Habits", "Habit routine makes change stick", ["A bedtime routine is a habit cue"], {
      savedAt: "2026-09-18T09:00:00.000Z",
      topicIds: [HABIT_TOPIC],
    }),
  );
  const sameTopic = await saveOverview(
    noteTitled("Memory", "Sleep rest protects memory", ["Tired brains forget"], {
      savedAt: "2026-09-20T09:00:00.000Z",
      topicIds: [SLEEP_TOPIC],
    }),
  );
  const newest = await saveOverview(
    noteTitled("Focus", "Sleep rest beats caffeine for focus", ["A nap restores attention", "Bedtime should be fixed"], {
      savedAt: "2026-09-25T09:00:00.000Z",
      topicIds: [SLEEP_TOPIC],
      verdict: {
        novelty: "fresh_angle",
        standsOut: null,
        dubious: false,
        dubiousClaims: null,
        reasoning: "Holds up.",
        similarTo: [{ overviewId: linkedNote.id, title: "Slow bread" }],
      },
    }),
  );
  return { newest, sameTopic, otherTopic, linked, founders };
};
