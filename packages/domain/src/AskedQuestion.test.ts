import assert from "node:assert/strict";
import test from "node:test";
import { AskedQuestions, foldAskedQuestions, recordAskedQuestion, type AskedQuestion } from "./AskedQuestion.js";
import { OverviewState } from "./OverviewState.js";

const ask = (question: string, askedAt: string, assistant: AskedQuestion["assistant"] = "claude"): AskedQuestion => ({
  question,
  assistant,
  askedAt,
});

test("asking a question again keeps only its latest ask, in the order asked", () => {
  const asked = [ask("Why?", "2026-11-14T10:00:00.000Z"), ask("How?", "2026-11-14T11:00:00.000Z")];

  const recorded = recordAskedQuestion(asked, ask("Why?", "2026-11-15T09:00:00.000Z", "gemini"), ["Why?", "How?"]);

  assert.deepEqual(recorded, [ask("How?", "2026-11-14T11:00:00.000Z"), ask("Why?", "2026-11-15T09:00:00.000Z", "gemini")]);
});

test("asks of questions the overview no longer has are dropped when another is recorded", () => {
  const recorded = recordAskedQuestion([ask("Old?", "2026-11-14T10:00:00.000Z")], ask("New?", "2026-11-15T09:00:00.000Z"), ["New?"]);

  assert.deepEqual(recorded, [ask("New?", "2026-11-15T09:00:00.000Z")]);
});

test("two copies' asks fold to each question once, at its latest ask", () => {
  const folded = foldAskedQuestions(
    [ask("Why?", "2026-11-14T10:00:00.000Z"), ask("How?", "2026-11-15T10:00:00.000Z")],
    [ask("Why?", "2026-11-15T08:00:00.000Z", "chatgpt"), ask("What?", "2026-11-13T10:00:00.000Z")],
  );

  assert.deepEqual(folded, [
    ask("Why?", "2026-11-15T08:00:00.000Z", "chatgpt"),
    ask("How?", "2026-11-15T10:00:00.000Z"),
    ask("What?", "2026-11-13T10:00:00.000Z"),
  ]);
});

test("state saved before asks existed reads as nothing asked, and an ask must name a known assistant", () => {
  const older = { overviewId: "f0b8a9a4-6a39-4b5e-9d8e-2f6a1c0e9b11", read: true, favourite: false, userTags: [] };

  assert.deepEqual(OverviewState.parse(older).asked, []);
  assert.throws(() => AskedQuestions.parse([{ question: "Why?", assistant: "copilot", askedAt: "2026-11-15T09:00:00.000Z" }]));
});
