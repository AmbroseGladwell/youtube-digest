import test from "node:test";
import assert from "node:assert/strict";
import { chatSystemPrompt } from "./chatPrompt.js";

const PASSAGES = [{ id: "p1", startMs: 0, endMs: 8_000, text: "Creatine is a backup store of energy." }];
const READER = "I'm a dad, and right now I'm focusing on sleep.";

test("with nothing known about the reader, the prompt is unchanged byte for byte", () => {
  for (const kind of ["video", "episode", "article", "recipe"] as const) {
    assert.equal(chatSystemPrompt(kind, "# Overview", PASSAGES, { reader: null }), chatSystemPrompt(kind, "# Overview", PASSAGES));
  }
});

test("the reader comes last, after the transcript, so a changed profile leaves the cached transcript whole", () => {
  const without = chatSystemPrompt("video", "# Overview", PASSAGES);
  const prompt = chatSystemPrompt("video", "# Overview", PASSAGES, { reader: READER });

  assert.ok(prompt.startsWith(without));
  assert.match(prompt.slice(without.length), /^\n\n# The reader\n/);
  assert.ok(prompt.endsWith("Settings › Personalisation."));
  assert.ok(prompt.includes(`\n\n${READER}\n\n`));
  assert.match(prompt, /never say the video says something because it fits them/);
});

test("a page answered from its overview alone is fitted to the reader too", () => {
  const prompt = chatSystemPrompt("recipe", "# Overview", [], { reader: READER });

  assert.ok(prompt.startsWith(chatSystemPrompt("recipe", "# Overview", [])));
  assert.match(prompt, /never say the recipe page says something because it fits them/);
});
