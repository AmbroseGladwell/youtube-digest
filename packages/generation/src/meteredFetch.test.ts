import test from "node:test";
import assert from "node:assert/strict";
import { meteredFetch } from "./meteredFetch.js";

const clock = (...readings: number[]) => () => readings.shift() ?? 0;

test("a call is timed to the end of its body, and the caller can still read the body", async () => {
  const inner = (async () =>
    new Response(JSON.stringify({ content: [], usage: { input_tokens: 10, output_tokens: 20 } }), { status: 200 })) as unknown as typeof fetch;
  const { http, calls } = meteredFetch("anthropic", inner, clock(1000, 3500));

  const response = await http("https://api.anthropic.com/v1/messages");

  assert.deepEqual(await response.json(), { content: [], usage: { input_tokens: 10, output_tokens: 20 } });
  assert.deepEqual(calls, [
    { status: 200, latencyMs: 2500, usage: { uncachedInputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 20 } },
  ]);
});

test("a refused call is recorded with no usage, and the body that is not JSON does not throw here", async () => {
  const inner = (async () => new Response("overloaded", { status: 529 })) as unknown as typeof fetch;
  const { http, calls } = meteredFetch("anthropic", inner, clock(0, 40));

  const response = await http("https://api.anthropic.com/v1/messages");

  assert.equal(await response.text(), "overloaded");
  assert.deepEqual(calls, [{ status: 529, latencyMs: 40, usage: null }]);
});
