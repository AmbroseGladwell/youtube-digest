import test from "node:test";
import assert from "node:assert/strict";
import { followUpHandOff, MOST_PREFILL_URL_LENGTH } from "./followUpHandOff.js";

const prompt = "<question>What are slop grenades & who pays?</question>";

test("Claude and ChatGPT open with the prompt filled in, encoded in the link", () => {
  assert.deepEqual(followUpHandOff("claude", prompt), {
    kind: "prefill",
    url: "https://claude.ai/new?q=%3Cquestion%3EWhat+are+slop+grenades+%26+who+pays%3F%3C%2Fquestion%3E",
  });
  const chatgpt = followUpHandOff("chatgpt", prompt);
  assert.equal(chatgpt.kind, "prefill");
  assert.equal(new URL(chatgpt.url).searchParams.get("q"), prompt);
  assert.equal(new URL(chatgpt.url).origin, "https://chatgpt.com");
});

test("Gemini can't be filled in by a link, so the prompt is copied and Gemini opened", () => {
  assert.deepEqual(followUpHandOff("gemini", prompt), { kind: "copyThenOpen", url: "https://gemini.google.com/app", text: prompt });
});

test("a prompt too long for a link is copied instead, never sent cut short", () => {
  const fits = "a".repeat(MOST_PREFILL_URL_LENGTH - "https://claude.ai/new?q=".length);
  assert.equal(followUpHandOff("claude", fits).kind, "prefill");
  assert.deepEqual(followUpHandOff("claude", `${fits}a`), { kind: "copyThenOpen", url: "https://claude.ai/new", text: `${fits}a` });
});
