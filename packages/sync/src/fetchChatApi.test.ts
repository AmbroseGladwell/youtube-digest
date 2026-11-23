import test from "node:test";
import assert from "node:assert/strict";
import type { ChatStreamEvent } from "@overview/domain";
import { createFetchChatApi } from "./fetchChatApi.js";
import { SyncRequestError, SyncTransportError } from "./SyncRequestError.js";

const OVERVIEW = "0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10";
const QUESTION = { conversationId: "5d1c3e8a-0f4b-4a52-9c3e-2b7a1d9e6f01", text: "How much?" };
const AT = "2026-11-16T10:00:00.000Z";

const streamCutInsideAndAcrossEvents = (events: ChatStreamEvent[], cuts = 7) => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    sent.push({ url: String(input), init });
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          for (let start = 0; start < text.length; start += cuts) {
            controller.enqueue(encoder.encode(text.slice(start, start + cuts)));
          }
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  };
  return { sent, fetch };
};

const answeredEvent: ChatStreamEvent = {
  type: "answered",
  chatId: `${OVERVIEW}:${QUESTION.conversationId}`,
  rev: 1,
  messages: [
    { from: "reader", text: "How much?", at: AT },
    { from: "answer", text: "Three grams.", at: AT, citations: [{ startMs: 1_000, endMs: 9_000 }], inSource: true },
  ],
};

test("an answer arrives a piece at a time, then settles as stored", async () => {
  const { sent, fetch } = streamCutInsideAndAcrossEvents([
    { type: "text", text: "Three " },
    { type: "text", text: "grams." },
    answeredEvent,
  ]);
  const pieces: string[] = [];

  const outcome = await createFetchChatApi({ baseUrl: "https://overview.example", fetch }).ask(OVERVIEW, QUESTION, (text) =>
    pieces.push(text),
  );

  assert.deepEqual(pieces, ["Three ", "grams."]);
  assert.deepEqual(outcome, answeredEvent);
  assert.equal(sent[0]?.url, `https://overview.example/api/chats/${OVERVIEW}/messages`);
  assert.equal(sent[0]?.init.method, "POST");
  assert.deepEqual(JSON.parse(String(sent[0]?.init.body)), QUESTION);
});

test("a failure while answering settles as failed, and a stream that never settles is a transport error", async () => {
  const failed = streamCutInsideAndAcrossEvents([
    { type: "text", text: "Thr" },
    { type: "failed", message: "Something went wrong answering that." },
  ]);
  assert.deepEqual(
    await createFetchChatApi({ baseUrl: "https://o.example", fetch: failed.fetch }).ask(OVERVIEW, QUESTION, () => undefined),
    {
      type: "failed",
      message: "Something went wrong answering that.",
    },
  );

  const cut = streamCutInsideAndAcrossEvents([{ type: "text", text: "Thr" }]);
  await assert.rejects(
    createFetchChatApi({ baseUrl: "https://o.example", fetch: cut.fetch }).ask(OVERVIEW, QUESTION, () => undefined),
    SyncTransportError,
  );
});

test("a wait before the answer starts is the API's own refusal, with its details", async () => {
  const fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "too_many_requests",
          message: "You've asked this month's questions on us.",
          details: { quota: "chat-month", resetsOn: "2026-12-01" },
        },
      }),
      { status: 429 },
    );

  await assert.rejects(
    createFetchChatApi({ baseUrl: "https://o.example", fetch }).ask(OVERVIEW, QUESTION, () => undefined),
    (error: unknown) => {
      assert.ok(error instanceof SyncRequestError);
      assert.equal(error.code, "too_many_requests");
      assert.deepEqual(error.details, { quota: "chat-month", resetsOn: "2026-12-01" });
      return true;
    },
  );
});

test("the month's allowance is read with what's used and when it resets", async () => {
  const usage = { plan: "free", resetsOn: "2026-12-01", used: 3, limit: 100 };
  const fetch = async () => new Response(JSON.stringify(usage), { status: 200 });

  assert.deepEqual(await createFetchChatApi({ baseUrl: "https://o.example", fetch }).usage(), usage);
});

test("a question over the library or a project goes to its own route, and says what it picks as it goes", async () => {
  const PROJECT = "7c2e9f10-0b8f-4f51-8a43-6a1d3c2e5f5a";
  const picked: ChatStreamEvent = { type: "picked", overviews: [{ overviewId: OVERVIEW as never, title: "Eat more plants" }] };
  const library = streamCutInsideAndAcrossEvents([{ type: "picking" }, picked, { type: "text", text: "Mostly beans." }, answeredEvent]);
  const progress: unknown[] = [];

  await createFetchChatApi({ baseUrl: "https://o.example", fetch: library.fetch }).askOver(
    { kind: "library" },
    QUESTION,
    () => undefined,
    undefined,
    (event) => progress.push(event),
  );
  const project = streamCutInsideAndAcrossEvents([answeredEvent]);
  await createFetchChatApi({ baseUrl: "https://o.example", fetch: project.fetch }).askOver(
    { kind: "project", id: PROJECT as never },
    QUESTION,
    () => undefined,
  );

  assert.equal(library.sent[0]?.url, "https://o.example/api/chats/library/messages");
  assert.deepEqual(progress, [{ type: "picking" }, picked]);
  assert.equal(project.sent[0]?.url, `https://o.example/api/chats/projects/${PROJECT}/messages`);
});

test("asking for suggested questions posts the scope and reads back what the server did", async () => {
  const PROJECT = "7c2e9f10-0b8f-4f51-8a43-6a1d3c2e5f5a";
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    sent.push({ url: String(input), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ status: "started" }), { status: 202 });
  };

  const status = await createFetchChatApi({ baseUrl: "https://o.example", fetch }).refreshSuggestedQuestions({
    kind: "project",
    projectId: PROJECT as never,
  });

  assert.equal(status, "started");
  assert.deepEqual(sent, [
    { url: "https://o.example/api/suggested-questions/refresh", body: { scope: { kind: "project", projectId: PROJECT } } },
  ]);
});
