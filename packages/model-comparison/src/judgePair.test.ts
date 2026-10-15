import test from "node:test";
import assert from "node:assert/strict";
import { parseComparedModel } from "./ComparedModel.js";
import { candidateGoesFirst, judgeFor, judgePair } from "./judgePair.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const opus = parseComparedModel("anthropic:claude-opus-5-5");

test("the judge is never from either note's provider", () => {
  assert.equal(judgeFor(opus, parseComparedModel("anthropic:claude-haiku-5-5")).model, "gpt-6.1-sol");
  assert.equal(judgeFor(opus, parseComparedModel("gemini:gemini-3.8-flash")).model, "gpt-6.1-sol");
  assert.equal(judgeFor(opus, parseComparedModel("openai:gpt-6-luna")).model, "gemini-3.1-pro-preview");
});

test("which note is A is fixed per pair, so a rerun asks the same question, and varies across pairs", () => {
  assert.equal(candidateGoesFirst("video-one", "openai:gpt-6-luna"), candidateGoesFirst("video-one", "openai:gpt-6-luna"));
  const orders = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => candidateGoesFirst(id, "openai:gpt-6-luna"));
  assert.ok(orders.includes(true) && orders.includes(false));
});

const call = (winner: string) => ({ reason: "Because.", winner });
const answer = (overall: string) => ({
  faithfulness: call("A"),
  verdict: call("B"),
  howToApply: call("tie"),
  chapters: call("A"),
  readsAloud: call("A"),
  overall: call(overall),
});

function openAiReplying(body: unknown, status = 200) {
  const sent: string[] = [];
  const http = (async (url: string, init: RequestInit) => {
    sent.push(`${url} ${String(init.body)}`);
    if (status !== 200) return new Response("down", { status });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }], usage: { prompt_tokens: 10_000, completion_tokens: 500 } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return { http, sent };
}

const pair = (candidate: string) => ({
  fetched: makeFetchedTranscript(),
  baseline: { name: "anthropic:claude-opus-5-5", overview: makeOverview() },
  candidate: { name: candidate, overview: makeOverview({ inOneLine: "The candidate's line." }) },
  keys: { openai: "sk", gemini: "g" },
});

test("A and B are turned back into the candidate's win or loss, whichever side it was shown on", async () => {
  const candidate = "gemini:gemini-3.8-flash";
  const { http, sent } = openAiReplying(answer("A"));

  const record = await judgePair({ ...pair(candidate), http });

  assert.equal(record.judge, "openai:gpt-6.1-sol");
  assert.equal(record.outcome, "judged");
  assert.equal(record.results?.overall, record.candidateIsA ? "win" : "loss");
  assert.equal(record.results?.howToApply, "tie");
  assert.equal(record.results?.verdict, record.candidateIsA ? "loss" : "win");
  assert.equal(record.costDollars, (10_000 * 2 + 500 * 10) / 1_000_000);
  const noteA = sent[0]!.indexOf("=== Note A ==="), candidateLine = sent[0]!.indexOf("The candidate's line.");
  assert.equal(candidateLine > noteA && candidateLine < sent[0]!.indexOf("=== Note B ==="), record.candidateIsA);
});

test("an answer that breaks the schema is the judge's failure, and a provider error is retried later", async () => {
  const broken = await judgePair({ ...pair("anthropic:claude-haiku-5-5"), http: openAiReplying({ overall: call("A") }).http });
  assert.equal(broken.outcome, "failed");
  assert.equal(broken.results, null);

  const down = await judgePair({ ...pair("anthropic:claude-haiku-5-5"), http: openAiReplying({}, 503).http });
  assert.equal(down.outcome, "errored");
  assert.equal(down.costDollars, 0);
});
