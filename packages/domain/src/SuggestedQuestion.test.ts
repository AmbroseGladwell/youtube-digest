import test from "node:test";
import assert from "node:assert/strict";
import {
  isSuggestedQuestionLive,
  mergeSuggestedQuestion,
  SuggestedQuestion,
  SuggestedQuestionChange,
  suggestedQuestionId,
} from "./SuggestedQuestion.js";
import { rebasePendingChanges } from "./rebasePendingChanges.js";

const PROJECT = "7a1d3c1e-5d0a-4b8e-9d55-0d1f6a0f2b11";
const FIRST = "0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10";
const SECOND = "f3c2a1b0-9e8d-4c7b-a6f5-e4d3c2b1a090";
const QUESTION = "5c2f7a1e-0d3b-4e8a-9b61-2f4d8c7e1a90";
const AT = "2026-11-23T10:00:00.000Z";
const LATER = "2026-11-23T11:00:00.000Z";
const LATEST = "2026-11-23T12:00:00.000Z";

const question = (overrides: Record<string, unknown> = {}) => ({
  id: suggestedQuestionId({ kind: "library" }, [FIRST, SECOND], QUESTION),
  scope: { kind: "library" },
  overviewIds: [FIRST, SECOND],
  text: "If sleep sets the dose, does the training plan in the other one still hold?",
  madeAt: AT,
  shownAt: null,
  askedAt: null,
  dismissedAt: null,
  feedback: null,
  ...overrides,
});

const applyAll = (changes: Array<Record<string, unknown>>) => changes.reduce(mergeSuggestedQuestion, question());

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) => permutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest]));

test("an id carries its scope and both overviews, sorted, so the server finds them by pattern", () => {
  assert.equal(suggestedQuestionId({ kind: "library" }, [SECOND, FIRST], QUESTION), `library:${FIRST}:${SECOND}:${QUESTION}`);
  assert.equal(
    suggestedQuestionId({ kind: "project", projectId: PROJECT as never }, [FIRST, SECOND], QUESTION),
    `project:${PROJECT}:${FIRST}:${SECOND}:${QUESTION}`,
  );
});

test("a question rests on exactly two different overviews, in a library or a project", () => {
  assert.ok(SuggestedQuestion.safeParse(question()).success);
  assert.ok(SuggestedQuestion.safeParse(question({ scope: { kind: "project", projectId: PROJECT } })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ overviewIds: [FIRST, FIRST] })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ overviewIds: [FIRST] })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ overviewIds: [FIRST, SECOND, QUESTION] })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ scope: { kind: "project" } })).success);
});

test("its text is one short sentence: never empty, never past the follow-up question's words or 300 characters", () => {
  assert.ok(!SuggestedQuestion.safeParse(question({ text: "" })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ text: Array.from({ length: 26 }, () => "word").join(" ") })).success);
  assert.ok(SuggestedQuestion.safeParse(question({ text: Array.from({ length: 25 }, () => "word").join(" ") })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ text: "x".repeat(301) })).success);
});

test("feedback is glad, obvious or none, with when it was given", () => {
  assert.ok(SuggestedQuestion.safeParse(question({ feedback: { verdict: "none", at: AT } })).success);
  assert.ok(SuggestedQuestion.safeParse(question({ feedback: { verdict: "glad", at: AT } })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ feedback: { verdict: "meh", at: AT } })).success);
  assert.ok(!SuggestedQuestion.safeParse(question({ feedback: { verdict: "glad" } })).success);
});

test("a device's change touches only what became of the question, and changes something", () => {
  assert.ok(SuggestedQuestionChange.safeParse({ shownAt: AT }).success);
  assert.ok(SuggestedQuestionChange.safeParse({ askedAt: AT, feedback: { verdict: "obvious", at: AT } }).success);
  assert.ok(!SuggestedQuestionChange.safeParse({}).success);
  assert.ok(!SuggestedQuestionChange.safeParse({ text: "Something else?" }).success);
  assert.ok(!SuggestedQuestionChange.safeParse({ madeAt: AT }).success);
  assert.ok(!SuggestedQuestionChange.safeParse({ feedback: null }).success);
});

test("shown, asked and dismissed keep the earliest time seen, so once done they stay done", () => {
  for (const field of ["shownAt", "askedAt", "dismissedAt"]) {
    assert.equal(applyAll([{ [field]: LATER }, { [field]: AT }])[field], AT);
    assert.equal(applyAll([{ [field]: AT }, { [field]: LATER }])[field], AT);
    assert.equal(applyAll([{ [field]: AT }, { feedback: { verdict: "glad", at: LATER } }])[field], AT);
  }
});

test("the later feedback wins, so a reader can change glad to obvious, and a tie goes to obvious", () => {
  const glad = { feedback: { verdict: "glad", at: AT } };
  const obvious = { feedback: { verdict: "obvious", at: LATER } };
  assert.deepEqual(applyAll([glad, obvious]).feedback, obvious.feedback);
  assert.deepEqual(applyAll([obvious, glad]).feedback, obvious.feedback);
  const gladAgain = { feedback: { verdict: "glad", at: LATEST } };
  assert.deepEqual(applyAll([gladAgain, obvious, glad]).feedback, gladAgain.feedback);
  const tied = [{ feedback: { verdict: "glad", at: AT } }, { feedback: { verdict: "obvious", at: AT } }];
  assert.deepEqual(applyAll(tied).feedback, applyAll([...tied].reverse()).feedback);
  assert.equal((applyAll(tied).feedback as { verdict: string }).verdict, "obvious");
});

test("changes settle the same whichever order they arrive in", () => {
  const changes = [
    { shownAt: LATER },
    { shownAt: AT, askedAt: LATEST },
    { dismissedAt: LATER },
    { feedback: { verdict: "glad", at: AT } },
    { feedback: { verdict: "obvious", at: LATEST }, askedAt: LATER },
  ];
  const settled = permutations(changes).map(applyAll);
  for (const result of settled) {
    assert.deepEqual(result, settled[0]);
  }
  assert.deepEqual(settled[0], question({ shownAt: AT, askedAt: LATER, dismissedAt: LATER, feedback: { verdict: "obvious", at: LATEST } }));
});

test("a merge never touches the text, the scope, the overviews or when it was made", () => {
  const merged = mergeSuggestedQuestion(question(), { text: "Changed?", madeAt: LATEST, shownAt: AT });
  assert.equal(merged.text, question().text);
  assert.equal(merged.madeAt, AT);
  assert.ok(SuggestedQuestion.safeParse(merged).success);
});

test("a pending change goes back on top of the server's copy", () => {
  const rebased = rebasePendingChanges(question({ shownAt: LATER }), [
    {
      key: 1,
      stuck: null,
      kind: "suggestedQuestion",
      id: question().id,
      updatedAt: LATEST,
      change: { op: "suggestedQuestion", change: { shownAt: AT } },
    },
  ]);
  assert.equal(rebased?.shownAt, AT);
});

test("a question dismissed or marked obvious is no longer live; one asked or marked glad still is", () => {
  const live = (overrides: Record<string, unknown>) => isSuggestedQuestionLive(SuggestedQuestion.parse(question(overrides)));
  assert.equal(live({}), true);
  assert.equal(live({ askedAt: AT }), true);
  assert.equal(live({ feedback: { verdict: "glad", at: AT } }), true);
  assert.equal(live({ dismissedAt: AT }), false);
  assert.equal(live({ feedback: { verdict: "obvious", at: AT } }), false);
});

test("Good question toggles off with a later none, which still loses to a later mark", () => {
  const glad = { feedback: { verdict: "glad", at: AT } };
  const cleared = { feedback: { verdict: "none" as const, at: LATER } };
  assert.deepEqual(applyAll([glad, cleared]).feedback, cleared.feedback);
  assert.deepEqual(applyAll([cleared, glad]).feedback, cleared.feedback);
  const gladAgain = { feedback: { verdict: "glad", at: LATEST } };
  assert.deepEqual(applyAll([gladAgain, cleared, glad]).feedback, gladAgain.feedback);
  assert.equal(isSuggestedQuestionLive({ dismissedAt: null, feedback: cleared.feedback }), true);
});
