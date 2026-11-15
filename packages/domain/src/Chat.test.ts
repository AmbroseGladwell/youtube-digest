import test from "node:test";
import assert from "node:assert/strict";
import { Chat, chatQuestionCount, chatRecordId, MAX_CHAT_QUESTIONS, type ChatMessage } from "./Chat.js";

const OVERVIEW = "0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10";
const AT = "2026-11-15T10:00:00.000Z";
const question: ChatMessage = { from: "reader", text: "How much?", at: AT };
const answer: ChatMessage = {
  from: "answer",
  text: "Three grams.",
  at: AT,
  citations: [{ startMs: 1_000, endMs: 60_000 }],
  inSource: true,
};
const chat = (messages: unknown[]) => ({ id: chatRecordId(OVERVIEW, "c1"), overviewId: OVERVIEW, startedAt: AT, messages });

test("a chat's id starts with its overview's, so an overview's chats share a prefix", () => {
  assert.equal(chatRecordId(OVERVIEW, "c1"), `${OVERVIEW}:c1`);
});

test("an answer carries its citations, as times or as an article's paragraph, and whether the source said it", () => {
  assert.ok(Chat.safeParse(chat([question, answer, question, { ...answer, citations: [{ paragraph: 4 }], inSource: false }])).success);
  const { inSource: _inSource, ...unsure } = answer;
  assert.ok(!Chat.safeParse(chat([question, unsure])).success);
  assert.ok(!Chat.safeParse(chat([question, { ...answer, citations: [{ startMs: 1_000 }] }])).success);
});

test("a chat holds at least one message and at most its questions' worth", () => {
  const full = Array.from({ length: MAX_CHAT_QUESTIONS }, () => [question, answer]).flat();
  assert.ok(!Chat.safeParse(chat([])).success);
  assert.ok(Chat.safeParse(chat(full)).success);
  assert.equal(chatQuestionCount(full), MAX_CHAT_QUESTIONS);
  assert.ok(!Chat.safeParse(chat([...full, question])).success);
});
