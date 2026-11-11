import test from "node:test";
import assert from "node:assert/strict";
import { runOne } from "./runOne.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";

const opus = { provider: "anthropic" as const, model: "claude-opus-5-5" };
const usage = { input_tokens: 10_000, output_tokens: 2_000 };
const callCost = (10_000 * 4 + 2_000 * 20) / 1_000_000;
const checkUsage = { input_tokens: 800, output_tokens: 10 };
const checkCost = (800 * 4 + 10 * 20) / 1_000_000;

// Answers the kind check with the given kind apart from the queue; every other call takes
// the next answer.
function anthropicReplying(...answers: ({ status: number; body: string } | unknown)[]) {
  return anthropicCheckingAs("default", ...answers);
}

function anthropicCheckingAs(kind: string, ...answers: ({ status: number; body: string } | unknown)[]) {
  const sent: string[] = [];
  const http = (async (_url: string, init: RequestInit) => {
    if (String(init.body).includes('"noteKind"')) {
      const text = JSON.stringify({ noteKind: kind });
      return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: checkUsage }), { status: 200 });
    }
    sent.push(String(init.body));
    const answer = answers.shift();
    if (typeof answer === "object" && answer !== null && "status" in answer && "body" in answer) {
      const failure = answer as { status: number; body: string };
      return new Response(failure.body, { status: failure.status });
    }
    const text = typeof answer === "string" ? answer : JSON.stringify(answer);
    return new Response(JSON.stringify({ content: [{ type: "text", text }], usage }), { status: 200 });
  }) as unknown as typeof fetch;
  return { http, sent };
}

const run = (http: typeof fetch) => runOne({ model: opus, apiKey: "test-key", fetched: makeFetchedTranscript(), http });

test("an answer valid first time is measured from the provider's own usage report", async () => {
  const { http } = anthropicReplying(makeGeneratedOutput());

  const record = await run(http);

  assert.equal(record.outcome, "passed-first");
  assert.equal(record.calls.length, 2);
  assert.equal(record.costDollars, checkCost + callCost);
  assert.deepEqual(record.kindCheck, { noteKind: "default", costDollars: checkCost });
  assert.equal(record.overview?.chapters?.length, 3);
  assert.equal(record.videoId, "video-one");
});

test("an answer that needed production's one retry is told apart, and both calls are paid for", async () => {
  const { http, sent } = anthropicReplying(makeGeneratedOutput({ keyPoints: [] }), makeGeneratedOutput());

  const record = await run(http);

  assert.equal(record.outcome, "passed-after-retry");
  assert.equal(record.attempts.length, 2);
  assert.equal(record.costDollars, checkCost + callCost * 2);
  assert.match(sent[1]!, /Your previous attempt was/);
});

test("an answer still invalid after the retry is the model's failure", async () => {
  const { http } = anthropicReplying(makeGeneratedOutput({ keyPoints: [] }), makeGeneratedOutput({ keyPoints: [] }));

  const record = await run(http);

  assert.equal(record.outcome, "failed");
  assert.equal(record.overview, null);
  assert.match(record.error ?? "", /failed its own schema after a retry/);
});

test("text that is not JSON at all is the model's failure too", async () => {
  const { http } = anthropicReplying("Here is your overview: {");

  assert.equal((await run(http)).outcome, "failed");
});

test("a provider error or a refused key is not held against the model, and the failed call costs nothing", async () => {
  for (const status of [500, 429, 401]) {
    const { http } = anthropicReplying({ status, body: "nope" });

    const record = await run(http);

    assert.equal(record.outcome, "errored", `status ${status}`);
    assert.equal(record.costDollars, checkCost);
  }
});

test("a model with no price is run but left unpriced rather than counted as free", async () => {
  const { http } = anthropicReplying(makeGeneratedOutput());

  const record = await runOne({
    model: { provider: "anthropic", model: "claude-unlisted" },
    apiKey: "test-key",
    fetched: makeFetchedTranscript(),
    http,
  });

  assert.equal(record.outcome, "passed-first");
  assert.equal(record.costDollars, null);
});

test("a recipe video's check and note are told apart, and the note's answers alone are its attempts", async () => {
  const recipe = {
    inOneLine: "A stew.",
    chapters: [{ title: "Start", summary: "The start.", startSegmentIndex: 0 }],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["stew", "dinner", "one-pot"],
    recipe: {
      summary: "A stew.",
      ingredients: ["salt"],
      steps: [{ text: "Stir.", group: null, startSegmentIndex: 0, endSegmentIndex: 0 }],
    },
  };
  const { http } = anthropicCheckingAs("recipe", recipe);

  const record = await run(http);

  assert.equal(record.outcome, "passed-first");
  assert.equal(record.attempts.length, 1);
  assert.equal(record.kindCheck?.noteKind, "recipe");
  assert.equal(record.overview?.recipe?.summary, "A stew.");
});
