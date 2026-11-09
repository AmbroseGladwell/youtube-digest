import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ProviderRequestError } from "../GenerationError.js";
import { anthropicAdapter } from "./anthropicAdapter.js";

const call = { apiKey: "sk-ant-test", model: "claude-sonnet-5-5" };
const request = { systemPrompt: "Write the note.", userMessage: "<video></video>", schema: z.object({ inOneLine: z.string() }) };
const answer = (text: string) =>
  new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200, headers: { "content-type": "application/json" } });
const refusal = (message: string) =>
  new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message } }), { status: 400 });

function recordingHttp(responses: Response[]) {
  const bodies: Record<string, unknown>[] = [];
  const http: typeof fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return responses.shift()!;
  };
  return { http, bodies };
}

test("a schema whose grammar Claude refuses is sent again in the prompt, unenforced", async () => {
  const { http, bodies } = recordingHttp([
    refusal("The compiled grammar is too large, which would cause performance issues."),
    answer('```json\n{"inOneLine":"A stew."}\n```'),
  ]);

  assert.deepEqual(await anthropicAdapter.generate(call, request, http), { inOneLine: "A stew." });
  assert.equal(bodies.length, 2);
  assert.ok("output_config" in bodies[0]!);
  assert.equal("output_config" in bodies[1]!, false);
  assert.match(String(bodies[1]!.system), /^Write the note\.\n\nReply with one JSON object .*"inOneLine"/s);
});

test("an unenforced answer with a sentence after the object still parses", async () => {
  const { http } = recordingHttp([
    refusal("The compiled grammar is too large."),
    answer('{"inOneLine":"A stew with {braces} and a \\"quote\\"."}\n\nLet me know if you need changes.'),
  ]);

  assert.deepEqual(await anthropicAdapter.generate(call, request, http), { inOneLine: 'A stew with {braces} and a "quote".' });
});

test("any other refusal is reported as it is, without a second request", async () => {
  const { http, bodies } = recordingHttp([refusal("max_tokens: too large")]);

  await assert.rejects(anthropicAdapter.generate(call, request, http), (error) => {
    assert.ok(error instanceof ProviderRequestError);
    assert.equal(error.status, 400);
    assert.match(error.message, /max_tokens: too large/);
    return true;
  });
  assert.equal(bodies.length, 1);
});
