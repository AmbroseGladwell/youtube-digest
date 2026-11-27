import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ProjectId, type SuggestedQuestion, type SuggestedQuestionScope } from "@overview/domain";
import { LIBRARY_QUESTION_BANK_MAX, PROJECT_QUESTION_BANK_MAX, questionsPastBank } from "./trimQuestionBank.js";

const LIBRARY: SuggestedQuestionScope = { kind: "library" };
const PROJECT: SuggestedQuestionScope = { kind: "project", projectId: ProjectId.parse(randomUUID()) };
const PROJECT_KEY = `project:${PROJECT.kind === "project" ? PROJECT.projectId : ""}`;

const question = (scope: SuggestedQuestionScope, day: number, overrides: Partial<SuggestedQuestion> = {}): SuggestedQuestion => ({
  id: randomUUID(),
  scope,
  overviewIds: [randomUUID(), randomUUID()] as never,
  text: "Does one survive the other?",
  madeAt: new Date(Date.UTC(2026, 10, day)).toISOString(),
  shownAt: null,
  askedAt: null,
  dismissedAt: null,
  feedback: null,
  ...overrides,
});
const days = (scope: SuggestedQuestionScope, count: number) => Array.from({ length: count }, (_, index) => question(scope, index + 1));

test("a scope at its max keeps every question", () => {
  assert.deepEqual(questionsPastBank(days(LIBRARY, LIBRARY_QUESTION_BANK_MAX), new Set(["library"])), []);
});

test("past the max the oldest go, each scope by its own max", () => {
  const library = days(LIBRARY, LIBRARY_QUESTION_BANK_MAX + 2);
  const project = days(PROJECT, PROJECT_QUESTION_BANK_MAX + 1);

  const past = questionsPastBank([...library, ...project], new Set(["library", PROJECT_KEY]));

  assert.deepEqual(new Set(past.map((each) => each.id)), new Set([library[0]!.id, library[1]!.id, project[0]!.id]));
});

test("asked, hidden and not-useful questions aren't in the bank, and other scopes are left alone", () => {
  const library = [
    ...days(LIBRARY, LIBRARY_QUESTION_BANK_MAX),
    question(LIBRARY, 20, { askedAt: "2026-11-21T00:00:00.000Z" }),
    question(LIBRARY, 21, { dismissedAt: "2026-11-22T00:00:00.000Z" }),
    question(LIBRARY, 22, { feedback: { verdict: "obvious", at: "2026-11-22T00:00:00.000Z" } }),
  ];

  assert.deepEqual(questionsPastBank(library, new Set(["library"])), []);
  assert.deepEqual(questionsPastBank(days(PROJECT, 20), new Set(["library"])), []);
});
