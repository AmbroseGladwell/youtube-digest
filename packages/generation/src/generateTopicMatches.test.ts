import test from "node:test";
import assert from "node:assert/strict";
import { generateTopicMatches } from "./generateTopicMatches.js";
import { GenerationError } from "./GenerationError.js";

const INPUT = {
  title: "Sleep Evolved Before Brains",
  source: "Quanta Magazine",
  inOneLine: "Hydras sleep without a brain.",
  keyPoints: ["Melatonin deepens it."],
  topics: [
    { name: "Health", description: "Your body's wellbeing, including sleep." },
    { name: "Food", description: null },
  ],
};

test("it sends the reader's topics with their descriptions, and the note without a transcript", async () => {
  let system = "";
  let user = "";
  const names = await generateTopicMatches(async ({ systemPrompt, userMessage }) => {
    system = systemPrompt;
    user = userMessage;
    return { matchedTopicNames: ["Health"] };
  }, INPUT);

  assert.deepEqual(names, ["Health"]);
  assert.match(system, /- "Health": Your body's wellbeing, including sleep\./);
  assert.match(system, /- "Food"\n/);
  assert.match(user, /- Melatonin deepens it\./);
});

test("matching none is an answer, not a failure", async () => {
  assert.deepEqual(await generateTopicMatches(async () => ({ matchedTopicNames: [] }), INPUT), []);
});

test("a topic that isn't on the reader's list fails its schema", async () => {
  await assert.rejects(() => generateTopicMatches(async () => ({ matchedTopicNames: ["Science"] }), INPUT), GenerationError);
});
