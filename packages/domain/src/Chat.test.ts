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

test("an answer carries its citations, as times, an article's paragraph or another chat's message, and whether the source said it", () => {
  assert.ok(Chat.safeParse(chat([question, answer, question, { ...answer, citations: [{ paragraph: 4 }], inSource: false }])).success);
  assert.ok(Chat.safeParse(chat([question, { ...answer, citations: [{ chatId: chatRecordId(OVERVIEW, "c0"), message: 3 }] }])).success);
  assert.ok(!Chat.safeParse(chat([question, { ...answer, citations: [{ chatId: chatRecordId(OVERVIEW, "c0") }] }])).success);
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

const OTHER = "6c1d3a7e-2b4f-4e8a-9c5d-1f2e3a4b5c6d";

test("an answer can cite another overview, or an item of it, by id and the title it had (OV-355)", () => {
  const item = { part: "keyPoint", index: 1, textHash: "0a1b2c3d" };
  assert.ok(Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, title: "Eat more plants", item }] }])).success);
  assert.ok(
    Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, title: "Eat more plants", item: null }] }])).success,
  );
  assert.ok(!Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, item: null }] }])).success);
  assert.ok(
    !Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, title: "T", item: null, part: "verdict" }] }])).success,
  );
});

test("a question keeps the other overviews it added, each with a fixed label, and the labels it set aside", () => {
  const added = { label: "S1", overviewId: OTHER, title: "Eat more plants", how: "found" };
  assert.ok(Chat.safeParse(chat([{ ...question, sources: [added], setAside: [] }, answer])).success);
  assert.ok(Chat.safeParse(chat([{ ...question, sources: [{ ...added, how: "pinned", brief: true }] }, answer])).success);
  assert.ok(!Chat.safeParse(chat([{ ...question, sources: [{ ...added, label: "S0" }] }, answer])).success);
  assert.ok(!Chat.safeParse(chat([{ ...question, sources: [{ ...added, how: "guessed" }] }, answer])).success);
});
