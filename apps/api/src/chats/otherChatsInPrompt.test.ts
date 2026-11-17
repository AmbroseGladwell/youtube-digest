import test from "node:test";
import assert from "node:assert/strict";
import type { Chat, ChatMessage } from "@overview/domain";
import { otherChatsInPrompt } from "./otherChatsInPrompt.js";

const OVERVIEW = "0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10";
const message = (from: "reader" | "answer", text: string, at: string): ChatMessage =>
  from === "reader" ? { from, text, at } : { from, text, at, citations: [], inSource: true };
const chat = (id: string, startedAt: string, messages: ChatMessage[]): Chat => ({
  id: `${OVERVIEW}:${id}`,
  overviewId: OVERVIEW as Chat["overviewId"],
  startedAt,
  messages,
});

const older = chat("older", "2026-11-01T10:00:00.000Z", [
  message("reader", "aaaa", "2026-11-01T10:00:00.000Z"),
  message("answer", "bbbb", "2026-11-01T10:00:01.000Z"),
]);
const newer = chat("newer", "2026-11-02T10:00:00.000Z", [
  message("reader", "cccc", "2026-11-02T10:00:00.000Z"),
  message("answer", "dddd", "2026-11-02T10:00:01.000Z"),
]);

test("every other chat goes in, oldest first, each message with an id that maps back to its chat and place", () => {
  const inPrompt = otherChatsInPrompt([newer, older]);
  assert.deepEqual(
    inPrompt.conversations.map(({ label, lines }) => [label, lines.map((line) => line.label)]),
    [
      ["c1", ["c1.m1", "c1.m2"]],
      ["c2", ["c2.m1", "c2.m2"]],
    ],
  );
  assert.deepEqual(inPrompt.labels.get("c2.m2"), { chatId: newer.id, message: 1 });
  assert.equal(inPrompt.messages, 4);
});

test("past the budget, the oldest messages are left out first, and a chat left with none drops out", () => {
  const inPrompt = otherChatsInPrompt([older, newer], 12);
  assert.deepEqual(
    inPrompt.conversations.map(({ label, lines }) => [label, lines.map((line) => `${line.label} ${line.text}`)]),
    [
      ["c1", ["c1.m2 bbbb"]],
      ["c2", ["c2.m1 cccc", "c2.m2 dddd"]],
    ],
  );
  assert.deepEqual(inPrompt.labels.get("c1.m2"), { chatId: older.id, message: 1 });
  assert.deepEqual(
    otherChatsInPrompt([older, newer], 8).conversations.map(({ label }) => label),
    ["c1"],
  );
  assert.deepEqual(otherChatsInPrompt([]).conversations, []);
});
