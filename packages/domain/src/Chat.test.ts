import test from "node:test";
import assert from "node:assert/strict";
import { CHAT_MIGRATIONS } from "./chatMigrations.js";
import { readStoredRecord } from "./readStoredRecord.js";
import {
  Chat,
  chatConversationId,
  chatOwner,
  chatOwnerOfId,
  chatQuestionCount,
  chatRecordId,
  MAX_CHAT_QUESTIONS,
  type ChatMessage,
} from "./Chat.js";

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

const PROJECT = "8d2e4f6a-1b3c-4d5e-9f7a-2b4c6d8e0f12";

test("a chat is owned by an overview, a project, or no one for the library, never two (OV-353)", () => {
  const { overviewId: _overviewId, ...unowned } = chat([question, answer]);
  assert.ok(Chat.safeParse(chat([question, answer])).success);
  assert.ok(Chat.safeParse({ ...unowned, projectId: PROJECT }).success);
  assert.ok(Chat.safeParse(unowned).success);
  assert.ok(!Chat.safeParse({ ...chat([question, answer]), projectId: PROJECT }).success);
  assert.deepEqual(chatOwner(Chat.parse(unowned)), { kind: "library" });
  assert.deepEqual(chatOwner(Chat.parse({ ...unowned, projectId: PROJECT })), { kind: "project", id: PROJECT });
});

test("an owner's chats share a prefix no other owner's can, and an id says whose chat it is", () => {
  assert.equal(chatRecordId({ kind: "overview", id: OVERVIEW }, "c1"), `${OVERVIEW}:c1`);
  assert.equal(chatRecordId({ kind: "project", id: PROJECT }, "c1"), `project:${PROJECT}:c1`);
  assert.equal(chatRecordId({ kind: "library" }, "c1"), "library:c1");
  assert.deepEqual(chatOwnerOfId(`${OVERVIEW}:c1`), { kind: "overview", id: OVERVIEW });
  assert.deepEqual(chatOwnerOfId(`project:${PROJECT}:c1`), { kind: "project", id: PROJECT });
  assert.deepEqual(chatOwnerOfId("library:c1"), { kind: "library" });
  assert.equal(chatOwnerOfId("nothing"), null);
  assert.equal(chatConversationId(`project:${PROJECT}:c1`), "c1");
});

test("an answer carries its sections, each naming its sources and how they relate, and the stats code counted", () => {
  const cited = { overviewId: OVERVIEW, title: "Start small", item: null };
  const sectioned = {
    ...answer,
    citations: [cited],
    inSource: false,
    sections: {
      intro: "Most start small.",
      introSources: [],
      sections: [
        { heading: "Scope", paragraphs: ["One habit."], numbered: [], bullets: [], sources: [{ citation: cited, relation: "Supports" }] },
      ],
      takeaway: "Pick one.",
    },
    stats: { overviews: 208, projects: 4, read: 5 },
  };
  assert.ok(Chat.safeParse(chat([{ ...question, picked: [OVERVIEW] }, sectioned])).success);
  assert.ok(!Chat.safeParse(chat([question, { ...sectioned, stats: { overviews: -1 } }])).success);
  assert.ok(!Chat.safeParse(chat([{ ...question, picked: Array.from({ length: 6 }, () => OVERVIEW) }, answer])).success);
});

test("another overview can be cited at a minute of its source, and a question keeps the minutes it sent (OV-352)", () => {
  const range = { startMs: 61_000, endMs: 120_000 };
  assert.ok(Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, title: "T", item: null, range }] }])).success);
  assert.ok(
    !Chat.safeParse(chat([question, { ...answer, citations: [{ overviewId: OTHER, title: "T", item: null, range: { startMs: 1 } }] }]))
      .success,
  );
  assert.ok(Chat.safeParse(chat([{ ...question, minutes: [{ overviewId: OTHER, passages: ["p13", "p14", "p15"] }] }, answer])).success);
  assert.ok(!Chat.safeParse(chat([{ ...question, minutes: [{ overviewId: OTHER, passages: ["14"] }] }, answer])).success);
});

test("a schema 5 answer of points reads as bullets, each point's sources cited once as Supports (OV-354)", () => {
  const cited = { overviewId: OTHER, title: "Start small", item: null };
  const old = {
    ...chat([
      question,
      {
        ...answer,
        citations: [cited],
        inSource: false,
        sections: {
          intro: "Most start small.",
          sections: [
            {
              heading: "Scope",
              points: [
                { text: "One habit.", citations: [cited] },
                { text: "Then two.", citations: [cited] },
              ],
            },
          ],
          takeaway: "Pick one.",
        },
      },
    ]),
    schemaVersion: 5,
  };
  const read = readStoredRecord(old, Chat, CHAT_MIGRATIONS);
  assert.equal(read.status, "read");
  const sections = read.status === "read" ? (read.record.messages[1] as Extract<ChatMessage, { from: "answer" }>).sections : undefined;
  assert.deepEqual(sections, {
    intro: "Most start small.",
    introSources: [],
    sections: [
      {
        heading: "Scope",
        paragraphs: [],
        numbered: [],
        bullets: ["One habit.", "Then two."],
        sources: [{ citation: cited, relation: "Supports" }],
      },
    ],
    takeaway: "Pick one.",
  });
});
