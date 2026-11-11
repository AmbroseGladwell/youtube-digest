import test from "node:test";
import assert from "node:assert/strict";
import type { ActionableItemsRecord } from "./extractActionableItems.js";
import type { StepsJudgeRecord } from "./judgeStepsCarried.js";
import { judgeStepsCarried, noteText } from "./judgeStepsCarried.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";
import { stepsMarkdown, stepsNotes } from "./stepsMarkdown.js";
import type { StepsSource } from "./StepsSource.js";

const source: StepsSource = { sourceId: "vid", title: "A protocol", units: ["one", "two", "three"], placeOf: (unit) => `0:0${unit}` };
const item = (text: string, start: number) => ({ text, kind: "step" as const, start, end: start });
const list = (items: ReturnType<typeof item>[]): ActionableItemsRecord => ({
  sourceId: "vid",
  judge: "gemini:x",
  extractedAt: "",
  outcome: "judged",
  error: null,
  items,
  calls: [],
  latencyMs: 0,
  costDollars: 0,
});
const verdicts = (...labels: ("carried" | "partly" | "missing")[]): StepsJudgeRecord => ({
  videoId: "vid",
  writer: "openai:gpt-6.1-sol",
  judge: "gemini:x",
  judgedAt: "",
  outcome: "judged",
  error: null,
  labels: { items: labels.map((verdict) => ({ reason: "r", verdict })) },
  calls: [],
  latencyMs: 0,
  costDollars: 0,
});
const overview = makeOverview();
const run = makeRunRecord({
  videoId: "vid",
  provider: "openai",
  model: "gpt-6.1-sol",
  overview: { ...overview, watchAnyway: { answer: "no", reason: "The overview covers the four steps.", range: null } },
});
const sources = new Map([["vid", source]]);

test("a missing item is reported with its place, and a note that says skip it yet misses one is counted", () => {
  const notes = stepsNotes(
    [run],
    sources,
    [list([item("Train legs", 0), item("Finishing fast is the goal", 2)])],
    [verdicts("carried", "missing")],
  );
  const markdown = stepsMarkdown(notes, "test");
  assert.match(markdown, /\*\*Missing:\*\* \n- Finishing fast is the goal \(0:02\)/);
  assert.match(markdown, /\| \*\*1\*\* \|/);
  assert.match(markdown, /"four steps"/);
});

test("a source with no actionable items reports no steps, not a 0% carried", () => {
  const [note] = stepsNotes([run], sources, [list([])], []);
  assert.equal(note?.items, "no steps");
  assert.match(stepsMarkdown([note!], "test"), /\| 1 \| 1 \| 0 \| 0 \| – \| – \| – \|/);
});

test("a note carrying every item reports none missing", () => {
  const notes = stepsNotes([run], sources, [list([item("A", 0), item("B", 1)])], [verdicts("carried", "carried")]);
  assert.match(stepsMarkdown(notes, "test"), /\*\*Missing:\*\* none/);
});

test("the note the judge reads holds every section a reader would act from, and never the watch-anyway reason", () => {
  const text = noteText({
    ...overview,
    howToApply: { items: ["Do the thing."] },
    watchAnyway: { answer: "no", reason: "SECRET REASON", range: null },
  });
  assert.match(text, /## Key points/);
  assert.match(text, /## How to apply\n- Do the thing\./);
  assert.ok(!text.includes("SECRET REASON"));
});

test("a judge never checks a note its own provider wrote", async () => {
  await assert.rejects(
    () =>
      judgeStepsCarried({
        videoId: "vid",
        overview,
        items: [item("A", 0)],
        writer: { provider: "gemini", model: "gemini-3.1-pro-preview" },
        judge: { provider: "gemini", model: "gemini-3.1-pro-preview" },
        keys: {},
      }),
    /judging its own provider's note/,
  );
});
