import test from "node:test";
import assert from "node:assert/strict";
import { generateTopicSuggestions } from "./generateTopicSuggestions.js";
import { GenerationError } from "./GenerationError.js";

const INPUT = { title: "Knife Skills in Ten Minutes", kind: "video" as const, text: "A chef shows the claw grip." };

test("it offers the starter topics with their descriptions, and sends the title and text", async () => {
  let system = "";
  let user = "";
  const result = await generateTopicSuggestions(async ({ systemPrompt, userMessage }) => {
    system = systemPrompt;
    user = userMessage;
    return { starterTopicNames: ["Food"], newTopicName: "Knife skills" };
  }, INPUT);

  assert.deepEqual(result, { starter: ["Food"], newTopic: "Knife skills" });
  assert.match(system, /- "Food": Cooking, recipes and eating well\./);
  assert.match(system, /the video they're about to have summarised/);
  assert.equal(user, "Title: Knife Skills in Ten Minutes\n\nA chef shows the claw grip.");
});

test("none is an answer, not a failure", async () => {
  assert.deepEqual(await generateTopicSuggestions(async () => ({ starterTopicNames: [], newTopicName: null }), INPUT), {
    starter: [],
    newTopic: null,
  });
});

test("a starter topic that isn't on offer fails its schema", async () => {
  await assert.rejects(
    () => generateTopicSuggestions(async () => ({ starterTopicNames: ["Cooking"], newTopicName: null }), INPUT),
    GenerationError,
  );
});

test("a new topic that repeats a starter one, runs long, or would make four is dropped", async () => {
  const suggest = (starterTopicNames: string[], newTopicName: string) =>
    generateTopicSuggestions(async () => ({ starterTopicNames, newTopicName }), INPUT);
  assert.equal((await suggest(["Health"], "food")).newTopic, null);
  assert.equal((await suggest(["Food"], "The art of slicing onions quickly")).newTopic, null);
  assert.equal((await suggest(["Food", "Home", "Health"], "Knife skills")).newTopic, null);
  assert.equal((await suggest(["Food"], "  Knife skills  ")).newTopic, "Knife skills");
});

test("a starter topic named twice is offered once, and never more than three", async () => {
  const result = await generateTopicSuggestions(
    async () => ({ starterTopicNames: ["Food", "Food", "Home", "Health", "Travel"], newTopicName: null }),
    INPUT,
  );
  assert.deepEqual(result.starter, ["Food", "Home", "Health"]);
});
