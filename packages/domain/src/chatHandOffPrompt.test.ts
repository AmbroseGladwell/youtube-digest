import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId } from "./Brands.js";
import { chatRecordId, type Chat } from "./Chat.js";
import { CONNECTED_CHAT_INSTRUCTION, chatHandOffPrompt } from "./chatHandOffPrompt.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const overview = makeOverview({
  id: OverviewId.parse("41cc60f4-40ec-43e8-9ed4-f90f79bae944"),
  coreClaim: "Creatine helps muscle a little and the brain claims are thin.",
  followUpQuestions: [{ question: "Can taking creatine every day damage your kidneys?", forReader: false }],
});
overview.source.title = "Creatine, debunked";
const chat: Chat = {
  id: chatRecordId(overview.id, "c1"),
  overviewId: overview.id,
  startedAt: "2026-11-16T10:00:00.000Z",
  messages: [
    { from: "reader", text: "How much lean mass?", at: "2026-11-16T10:00:00.000Z" },
    {
      from: "answer",
      text: "A little more than training alone.",
      at: "2026-11-16T10:00:05.000Z",
      citations: [{ startMs: 208_000, endMs: 263_000 }],
      inSource: true,
    },
  ],
};

test("connected, the prompt names the overview and the conversation for the assistant to read, not the web", () => {
  assert.equal(
    chatHandOffPrompt(chat, overview, true),
    `${CONNECTED_CHAT_INSTRUCTION}\n<overview>Creatine, debunked (The Overview id ${overview.id})</overview>\n<conversation>${chat.id}</conversation>`,
  );
  assert.match(CONNECTED_CHAT_INSTRUCTION, /get_chat.*get_transcript rather than searching the web/);
});

test("not connected, the prompt carries the note, without its own questions, and the conversation so far", () => {
  const prompt = chatHandOffPrompt(chat, overview, false);

  assert.match(prompt, /Creatine helps muscle a little/);
  assert.match(prompt, /The reader asked\*\* \(2026-11-16\): How much lean mass\?/);
  assert.match(prompt, /A little more than training alone\./);
  assert.doesNotMatch(prompt, /damage your kidneys|get_chat/);
});
