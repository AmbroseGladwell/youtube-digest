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

test("it asks for a specific interest that may sit inside a broad topic, not a tag", async () => {
  let system = "";
  await generateTopicSuggestions(async ({ systemPrompt }) => {
    system = systemPrompt;
    return { starterTopicNames: [], newTopicName: null };
  }, INPUT);
  assert.match(system, /"Knife skills" within Food/);
  assert.match(system, /It may sit inside a topic on offer\./);
  assert.match(system, /an interest, not a tag/);
});

test("a new topic that repeats a starter one or runs long is dropped, and a tidy one is kept", async () => {
  const suggest = (starterTopicNames: string[], newTopicName: string) =>
    generateTopicSuggestions(async () => ({ starterTopicNames, newTopicName }), INPUT);
  assert.equal((await suggest(["Health"], "food")).newTopic, null);
  assert.equal((await suggest(["Food"], "The art of slicing onions very quickly")).newTopic, null);
  assert.equal((await suggest(["Food"], "  Knife skills  ")).newTopic, "Knife skills");
  assert.equal((await suggest(["Fitness"], "Marathon training")).newTopic, "Marathon training");
});

test("a specific interest keeps its place, so three starter topics make room for it", async () => {
  assert.deepEqual(
    await generateTopicSuggestions(async () => ({ starterTopicNames: ["Food", "Home", "Health"], newTopicName: "Knife skills" }), INPUT),
    { starter: ["Food", "Home"], newTopic: "Knife skills" },
  );
});

test("a starter topic named twice is offered once, and never more than three", async () => {
  const result = await generateTopicSuggestions(
    async () => ({ starterTopicNames: ["Food", "Food", "Home", "Health", "Travel"], newTopicName: null }),
    INPUT,
  );
  assert.deepEqual(result.starter, ["Food", "Home", "Health"]);
});
