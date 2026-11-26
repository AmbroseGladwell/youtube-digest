import { QUESTION_WRITER_MODEL } from "./questionModels.js";
import test from "node:test";
import assert from "node:assert/strict";
import type { SuggestedQuestionScope } from "@overview/domain";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { ClaimPairsRepository } from "./ClaimPairsRepository.js";
import { libraryCandidates, pairKeyOf, projectCandidates } from "./questionCandidates.js";
import { saveSmallLibrary, setUpRefresh, type RefreshSetting } from "./SuggestedQuestionRefresher.testHelper.js";
import { writeSuggestedQuestions } from "./writeSuggestedQuestions.js";

const LIBRARY: SuggestedQuestionScope = { kind: "library" };
const inProject = (projectId: string): SuggestedQuestionScope => ({ kind: "project", projectId: projectId as never });
const key = (first: string, second: string) => [first, second].sort().join("|");

const sources = ({ testApp }: RefreshSetting) => ({
  claimPairs: new ClaimPairsRepository(testApp.sql),
  records: new RecordsRepository(testApp.sql, () => testApp.clock.now),
  model: "concept-test",
});

const refreshRows = async ({ testApp, account }: RefreshSetting) =>
  testApp.sql.query<{ outcome: string; pairs_labelled: number; questions_written: number; scopes: string[] }>(
    "select outcome, pairs_labelled, questions_written, scopes from question_refreshes where account_id = $1 order by started_at",
    [account.accountId],
  );

const seedQuestion = async (setting: RefreshSetting, scope: SuggestedQuestionScope, overviewIds: [string, string], text: string) => {
  const records = new RecordsRepository(setting.testApp.sql, () => setting.testApp.clock.now);
  const [written] = await writeSuggestedQuestions(
    records,
    setting.account.accountId,
    [{ scope, overviewIds, text }],
    setting.testApp.clock.now,
  );
  return written!.id;
};

const markQuestion = async ({ account }: RefreshSetting, id: string, body: Record<string, unknown>) => {
  const response = await account.inject({
    method: "PUT",
    url: `/api/suggested-questions/${id.split(":").join("/")}`,
    body: { updatedAt: "2026-09-26T09:00:00.000Z", ...body },
  });
  assert.equal(response.statusCode, 200, response.body);
};

const refreshed = async (setting: RefreshSetting, scope: SuggestedQuestionScope = LIBRARY) => {
  const { status } = await setting.refresh(scope);
  await setting.testApp.drainQuestions();
  return status;
};

test("library candidates start from the newest save: its similarTo link, its closest partner on another topic, then its closest partner", async (t) => {
  const setting = await setUpRefresh(t);
  const library = await saveSmallLibrary(setting);

  const candidates = await libraryCandidates(sources(setting), setting.account.accountId);

  assert.deepEqual(
    candidates.slice(0, 3).map((candidate) => [pairKeyOf(candidate), candidate.origin]),
    [
      [key(library.newest, library.linked), "similarTo"],
      [key(library.newest, library.otherTopic), "crossTopic"],
      [key(library.newest, library.sameTopic), "closest"],
    ],
  );
  assert.equal(new Set(candidates.map(pairKeyOf)).size, candidates.length);
});

test("a project's candidates are the pairs among its live members, never with an overview outside it", async (t) => {
  const setting = await setUpRefresh(t);
  const library = await saveSmallLibrary(setting);
  const members = [library.newest, library.sameTopic, library.founders];

  const candidates = await projectCandidates(sources(setting), setting.account.accountId, members);

  assert.deepEqual(
    candidates.map(pairKeyOf).sort(),
    [key(library.newest, library.sameTopic), key(library.newest, library.founders), key(library.sameTopic, library.founders)].sort(),
  );
  assert.equal(pairKeyOf(candidates[0]!), key(library.newest, library.sameTopic));
});

test("a free plan refreshes nothing, calls no model and keeps no note of the opening", async (t) => {
  const setting = await setUpRefresh(t, { plan: "free" });
  await saveSmallLibrary(setting);

  assert.equal(await refreshed(setting), "free");
  assert.equal(setting.labeller.requests.length + setting.writer.requests.length, 0);
  const opened = await setting.testApp.sql.query("select 1 from question_scopes_opened where account_id = $1", [setting.account.accountId]);
  assert.equal(opened.length, 0);
});

test("a refresh comes at least two days after the last, and only once something new was saved", async (t) => {
  const setting = await setUpRefresh(t);
  await saveSmallLibrary(setting);

  assert.equal(await refreshed(setting), "started");
  assert.ok(setting.labeller.requests.length > 0);
  assert.equal(await refreshed(setting), "not-due");
  setting.advanceDays(2);
  assert.equal(await refreshed(setting), "not-due");
  await setting.save("Naps", "A short nap restores rest", ["Keep it under half an hour"], { savedAt: "2026-09-27T09:00:00.000Z" });
  setting.advanceDays(0.01);
  assert.equal(await refreshed(setting), "started");
});

test("no more than three refreshes in seven days", async (t) => {
  const setting = await setUpRefresh(t);
  await saveSmallLibrary(setting);
  const saveSomething = (day: number) =>
    setting.save(`Note ${day}`, "Rest and routine both matter", ["A nap helps"], { savedAt: `2026-10-0${day}T09:00:00.000Z` });

  assert.equal(await refreshed(setting), "started");
  for (const day of [1, 2]) {
    setting.advanceDays(2);
    await saveSomething(day);
    assert.equal(await refreshed(setting), "started");
  }
  setting.advanceDays(2);
  await saveSomething(3);
  assert.equal(await refreshed(setting), "not-due");
  setting.advanceDays(1.5);
  assert.equal(await refreshed(setting), "started");
});

test("this month's question costs at the cap stop a refresh, and last month's don't count", async (t) => {
  const setting = await setUpRefresh(t);
  await saveSmallLibrary(setting);
  const { sql } = setting.testApp;
  const cost = (day: string, dollars: number) =>
    sql.query(
      "insert into account_costs (day, account_id, area, detail, calls, quantity, dollars) values ($1, $2, 'questions', 'write', 1, 100, $3)",
      [day, setting.account.accountId, dollars],
    );

  await cost("2026-08-31", 5);
  await cost("2026-09-02", 0.4);
  assert.equal(await refreshed(setting), "capped");
  assert.equal(setting.labeller.requests.length, 0);
  await sql.query("update account_costs set dollars = 0.39 where account_id = $1 and day = '2026-09-02'", [setting.account.accountId]);
  assert.equal(await refreshed(setting), "started");
});

test("one refresh at a time: a second asked while the first is writing is busy", async (t) => {
  let release = () => undefined as void;
  const setting = await setUpRefresh(t, { answersAfter: new Promise<void>((resolve) => (release = resolve)) });
  await saveSmallLibrary(setting);

  const first = await setting.refresh(LIBRARY);
  const second = await setting.refresh(LIBRARY);
  release();
  await setting.testApp.drainQuestions();

  assert.deepEqual([first.status, second.status], ["started", "busy"]);
});

test("a refresh left running past fifteen minutes no longer holds the lock, though it still counts", async (t) => {
  const setting = await setUpRefresh(t);
  await saveSmallLibrary(setting);
  const running = (minutesAgo: number) =>
    setting.testApp.sql.query("insert into question_refreshes (account_id, started_at) values ($1, $2::timestamptz)", [
      setting.account.accountId,
      new Date(setting.testApp.clock.now.getTime() - minutesAgo * 60_000).toISOString(),
    ]);

  await running(16);
  assert.equal(await refreshed(setting), "not-due");
  await running(1);
  assert.equal(await refreshed(setting), "busy");
});

test("with every slot taken nothing calls a model, and the refresh doesn't count against the next", async (t) => {
  const setting = await setUpRefresh(t);
  const library = await saveSmallLibrary(setting);
  const ids = [library.newest, library.sameTopic, library.otherTopic, library.linked, library.founders];
  for (let index = 0; index < 6; index += 1) {
    await seedQuestion(setting, LIBRARY, [ids[index % 5]!, ids[(index + 2) % 5]!], `Question ${index}?`);
  }

  assert.equal(await refreshed(setting), "started");
  assert.equal(setting.labeller.requests.length + setting.writer.requests.length, 0);
  assert.deepEqual(
    (await refreshRows(setting)).map((row) => [row.outcome, row.pairs_labelled]),
    [["full", 0]],
  );
  assert.equal(await refreshed(setting), "started");
});

test("a project takes part only once its chat was opened and while it has two live members", async (t) => {
  const setting = await setUpRefresh(t);
  const library = await saveSmallLibrary(setting);
  const project = await setting.project([library.newest, library.founders]);
  const lonely = await setting.project([library.otherTopic]);
  const forProject = () => setting.labelled().filter((content) => content.includes("# This is for the project"));

  assert.equal(await refreshed(setting, inProject(lonely)), "started");
  assert.equal(forProject().length, 0);
  await setting.testApp.sql.query("delete from question_refreshes where account_id = $1", [setting.account.accountId]);

  assert.equal(await refreshed(setting, inProject(project)), "started");
  assert.equal(forProject().length, 1);
  assert.match(forProject()[0]!, /Note A: (Focus|Founders)/);
  assert.deepEqual((await refreshRows(setting)).at(-1)!.scopes, ["library", `project:${project}`]);
});

test("a refresh labels fresh pairs, writes what passes the record's rules, and costs it under questions", async (t) => {
  const tooLong = `Does ${"the routine really ".repeat(8)}matter?`;
  const { lines, logger } = recordingLogger();
  const setting = await setUpRefresh(t, {
    logger,
    writerReply: {
      questions: [
        { pair: 1, question: "Could a slow proving schedule say anything about fixing a bedtime?" },
        { pair: 1, question: "Is there another angle on the very same pair here?" },
        { pair: 99, question: "Which of these would a founder pick first?" },
        { pair: 2, question: tooLong },
        { pair: 3, question: "Rest matters. Does routine matter more?" },
        { pair: 2, question: "Does a habit cue at bedtime beat more rest for focus?" },
      ],
    },
  });
  const library = await saveSmallLibrary(setting);
  const obvious = await seedQuestion(setting, LIBRARY, [library.founders, library.otherTopic], "Do founders need habits too?");
  await markQuestion(setting, obvious, { feedback: { verdict: "obvious", at: "2026-09-26T08:00:00.000Z" } });
  await seedQuestion(setting, LIBRARY, [library.sameTopic, library.founders], "Does memory decide who succeeds a founder?");
  const asked = await seedQuestion(setting, LIBRARY, [library.newest, library.linked], "Is bread like sleep?");
  await markQuestion(setting, asked, { dismissedAt: "2026-09-26T08:00:00.000Z" });

  assert.equal(await refreshed(setting), "started");

  const pairOf = (content: string) =>
    [...content.matchAll(/## Note [AB]: (\w+)/g)]
      .map((match) => match[1])
      .sort()
      .join("|");
  const labelledPairs = setting.labelled().map(pairOf);
  assert.ok(labelledPairs.length > 0 && labelledPairs.length <= 8);
  assert.ok(!labelledPairs.includes("Focus|Slow"), "a pair once asked is never labelled again, even dismissed");
  assert.ok(!labelledPairs.includes("Founders|Habits"));
  assert.equal(setting.writer.requests.length, 1);
  const [system, user] = setting.written()[0]!;
  assert.equal(setting.writer.requests[0]!.model, QUESTION_WRITER_MODEL.model);
  assert.match(system!.content, /found questions like these obvious:\n- Do founders need habits too\?/);
  assert.match(system!.content, /already on show\. Don't repeat their themes:\n- Does memory decide who succeeds a founder\?/);
  assert.match(system!.content, /draws on both overviews of its pair/);
  assert.match(user!.content, /## Pair 1, for the whole library, which can take 3 \(different view\)/);

  const fed = (await setting.account.changes()).changes.filter(
    (change) => change.kind === "suggestedQuestion" && change.body !== undefined && !change.deleted,
  );
  const texts = fed.map((change) => change.body!.text);
  assert.ok(texts.includes("Could a slow proving schedule say anything about fixing a bedtime?"));
  assert.ok(texts.includes("Does a habit cue at bedtime beat more rest for focus?"));
  assert.equal(fed.length, 5);
  assert.deepEqual(
    (await refreshRows(setting)).map((row) => [row.outcome, row.questions_written, row.pairs_labelled === labelledPairs.length]),
    [["written", 2, true]],
  );

  const costs = await new AccountCostsRepository(setting.testApp.sql).of({ accountId: setting.account.accountId });
  assert.deepEqual(
    costs.filter((cost) => cost.area === "questions").map((cost) => [cost.detail, cost.calls, cost.dollars > 0]),
    [
      ["label", labelledPairs.length, true],
      ["write", 1, true],
    ],
  );

  const refreshLines = lines.filter((line) => line.logCode === "api.questions.refreshed");
  const done = refreshLines.find((line) => line.outcome === "written")!;
  assert.deepEqual(
    { plan: done.plan, status: done.status, library: done.library, projects: done.projects, written: done.questionsWritten },
    { plan: "plus", status: "started", library: true, projects: 0, written: 2 },
  );
  assert.ok(Number(done.candidates) >= labelledPairs.length);
  assert.deepEqual(
    {
      real: done.labelsReal,
      stretch: done.labelsStretch,
      notConnected: done.labelsNotConnected,
      failed: done.labelsFailed,
      toWriter: done.pairsToWriter,
      returned: done.writerReturned,
      dropped: done.dropped,
      skippedOnWrite: done.skippedOnWrite,
    },
    {
      real: labelledPairs.length,
      stretch: 0,
      notConnected: 0,
      failed: 0,
      toWriter: Math.min(labelledPairs.length, 4),
      returned: 6,
      dropped: { badPair: 1, textLimits: 1, notOneSentence: 1, samePair: 1, noRoom: 0 },
      skippedOnWrite: 0,
    },
  );
  const logged = JSON.stringify(refreshLines);
  for (const forbidden of ["Focus", "bedtime", library.newest, library.linked]) {
    assert.ok(!logged.includes(forbidden), `the log line carries ${forbidden}`);
  }
});

test("a writer that fails leaves no questions, marks the refresh failed and logs it", async (t) => {
  const { lines, logger } = recordingLogger();
  const setting = await setUpRefresh(t, { logger, writerReply: "not json at all" });
  await saveSmallLibrary(setting);

  assert.equal(await refreshed(setting), "started");

  assert.deepEqual(
    (await refreshRows(setting)).map((row) => row.outcome),
    ["failed"],
  );
  assert.equal((await setting.account.changes()).changes.filter((change) => change.kind === "suggestedQuestion").length, 0);
  assert.equal(lines.filter((line) => line.logCode === "api.questions.refreshFailed").length, 1);
  const costs = await new AccountCostsRepository(setting.testApp.sql).of({ accountId: setting.account.accountId });
  assert.ok(costs.some((cost) => cost.area === "questions" && cost.detail === "write-failed"));
});
