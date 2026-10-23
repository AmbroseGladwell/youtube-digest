import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { PROVIDERS } from "@overview/domain";
import { adapterFor } from "./adapterFor.js";
import { ProviderKeyRefusedError, ProviderOutOfCreditError, ProviderRequestError } from "./GenerationError.js";
import { listProviderModels } from "./listProviderModels.js";
import { createGenerationClient } from "./createGenerationClient.js";

const schema = z.object({ inOneLine: z.string() });
const request = { systemPrompt: "You judge a video.", userMessage: "Title: t", schema };
const answer = { inOneLine: "A simulated creator explains one claim." };

interface Call {
  url: string;
  init: RequestInit;
}

function recorder(respond: (call: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const http = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const { status = 200, body } = respond(call);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, http };
}

const BODIES: Record<string, unknown> = {
  anthropic: { content: [{ type: "text", text: JSON.stringify(answer) }] },
  gemini: { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] },
  chat: { choices: [{ message: { content: JSON.stringify(answer) } }] },
};

const generationBody = (provider: string) =>
  provider === "anthropic" ? BODIES.anthropic : provider === "gemini" ? BODIES.gemini : BODIES.chat;

test("every provider sends the key to its own origin and parses the answer back out", async () => {
  for (const provider of PROVIDERS) {
    const { calls, http } = recorder(() => ({ body: generationBody(provider) }));

    const client = createGenerationClient({ provider, apiKey: "sk-test", model: "a-model", http });
    const parsed = await client(request);

    assert.deepEqual(parsed, answer, provider);
    assert.equal(calls.length, 1, provider);
    const [call] = calls;
    assert.ok(call !== undefined);
    assert.equal(call.init.method, "POST", provider);
    const sent = JSON.stringify(call.init.headers);
    assert.match(sent, /sk-test/, provider);
  }
});

test("the key never travels in the address, where a log or a referrer would keep it", async () => {
  for (const provider of PROVIDERS) {
    const { calls, http } = recorder(() => ({ body: generationBody(provider) }));

    await createGenerationClient({ provider, apiKey: "sk-secret", model: "a-model", http })(request);
    const [call] = calls;
    assert.ok(call !== undefined);
    assert.equal(call.url.includes("sk-secret"), false, provider);
  }
});

test("Anthropic is sent the header that lets a browser call it at all", async () => {
  const { calls, http } = recorder(() => ({ body: BODIES.anthropic }));

  await createGenerationClient({ provider: "anthropic", apiKey: "sk", model: "claude-opus-5-5", http })(request);

  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(headers["x-api-key"], "sk");
});

test("the five that take a schema are sent one, and DeepSeek is taught the shape in words", async () => {
  for (const provider of PROVIDERS) {
    const { calls, http } = recorder(() => ({ body: generationBody(provider) }));

    await createGenerationClient({ provider, apiKey: "sk", model: "a-model", http })(request);
    const body = JSON.parse(String(calls[0]?.init.body));

    if (provider === "deepseek") {
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.match(body.messages[0].content, /json object/);
      assert.match(body.messages[0].content, /"inOneLine"/);
    } else {
      assert.equal(JSON.stringify(body).includes('"inOneLine"'), true, provider);
      assert.equal(JSON.stringify(body).includes("json_object"), false, provider);
    }
  }
});

test("OpenAI is sent max_completion_tokens, which its newer models require, and the rest keep max_tokens", async () => {
  for (const provider of ["openai", "deepseek", "xai", "mistral"] as const) {
    const { calls, http } = recorder(() => ({ body: BODIES.chat }));

    await createGenerationClient({ provider, apiKey: "sk", model: "a-model", http })(request);
    const body = JSON.parse(String(calls[0]?.init.body));

    const [sent, absent] = provider === "openai" ? ["max_completion_tokens", "max_tokens"] : ["max_tokens", "max_completion_tokens"];
    assert.equal(typeof body[sent], "number", provider);
    assert.equal(absent in body, false, provider);
  }
});

test("a refused key is told apart from every other failure, because a different screen reports it", async () => {
  for (const provider of PROVIDERS) {
    const { http } = recorder(() => ({ status: 401, body: { error: "invalid key" } }));

    await assert.rejects(
      () => listProviderModels(provider, "sk-wrong", http),
      ProviderKeyRefusedError,
      provider,
    );
  }
});

test("a provider that is simply down is not reported as a bad key", async () => {
  const { http } = recorder(() => ({ status: 503, body: { error: "overloaded" } }));

  await assert.rejects(() => listProviderModels("openai", "sk", http), ProviderRequestError);
});

// Each provider's own error body, in the shape its API documents for an account with no
// credit left.
const OUT_OF_CREDIT = {
  openai: {
    status: 429,
    body: {
      error: {
        message: "You exceeded your current quota, please check your plan and billing details.",
        type: "insufficient_quota",
        param: null,
        code: "insufficient_quota",
      },
    },
  },
  anthropic: {
    status: 400,
    body: {
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
      },
    },
  },
  deepseek: { status: 402, body: { error: { message: "Insufficient Balance", type: "unknown_error", code: "invalid_request_error" } } },
} as const;

test("an account out of credit is told apart from a provider that is down, in each provider's own words", async () => {
  for (const [provider, failure] of Object.entries(OUT_OF_CREDIT)) {
    const { http } = recorder(() => failure);
    const client = createGenerationClient({ provider: provider as keyof typeof OUT_OF_CREDIT, apiKey: "sk", model: "m", http });

    await assert.rejects(() => client(request), ProviderOutOfCreditError, provider);
  }
});

test("an ordinary rate limit is not mistaken for an account out of credit", async () => {
  const { http } = recorder(() => ({
    status: 429,
    body: { error: { message: "Rate limit reached for requests", type: "requests", code: "rate_limit_exceeded" } },
  }));
  const client = createGenerationClient({ provider: "openai", apiKey: "sk", model: "m", http });

  const error = await client(request).catch((caught: unknown) => caught);

  assert.ok(error instanceof ProviderRequestError);
  assert.ok(!(error instanceof ProviderOutOfCreditError));
});

test("the models a key can reach are listed, and the ones that cannot write an overview counted", async () => {
  const { http } = recorder(() => ({
    body: { data: [{ id: "gpt-6.1-sol" }, { id: "gpt-6-luna" }, { id: "text-embedding-3-small" }] },
  }));

  assert.deepEqual(await listProviderModels("openai", "sk", http), {
    usable: ["gpt-6-luna", "gpt-6.1-sol"],
    unusable: 1,
  });
});

test("Gemini is believed when it says which models answer a generate call, rather than read by name", async () => {
  const { http } = recorder(() => ({
    body: {
      models: [
        { name: "models/gemini-3.6", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      ],
    },
  }));

  assert.deepEqual(await listProviderModels("gemini", "sk", http), { usable: ["gemini-3.6"], unusable: 1 });
});

test("Mistral is believed the same way, from the capabilities it sends with each model", async () => {
  const { http } = recorder(() => ({
    body: {
      data: [
        { id: "mistral-large-latest", capabilities: { completion_chat: true } },
        { id: "mistral-embed", capabilities: { completion_chat: false } },
      ],
    },
  }));

  assert.deepEqual(await listProviderModels("mistral", "sk", http), {
    usable: ["mistral-large-latest"],
    unusable: 1,
  });
});

test("Gemini's catalogue spelling is not the spelling it is called by", async () => {
  const { calls, http } = recorder(() => ({ body: BODIES.gemini }));

  await createGenerationClient({ provider: "gemini", apiKey: "sk", model: "models/gemini-3.6", http })(request);

  assert.match(String(calls[0]?.url), /\/models\/gemini-3\.6:generateContent$/);
});

test("every provider is reachable through the one lookup, so none can be added without an adapter", () => {
  for (const provider of PROVIDERS) {
    assert.equal(typeof adapterFor(provider).generate, "function", provider);
    assert.equal(typeof adapterFor(provider).listModels, "function", provider);
  }
});
