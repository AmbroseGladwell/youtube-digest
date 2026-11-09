import test from "node:test";
import assert from "node:assert/strict";
import { suggestStarterTopics } from "./suggestStarterTopics.js";

test("suggests the topics a cooking video's title and description point to", () => {
  assert.deepEqual(
    suggestStarterTopics("Knife Skills in Ten Minutes", "A chef shows the claw grip and how to dice an onion for dinner in your kitchen."),
    ["Food"],
  );
});

test("a word in the title is enough on its own, and a plural still matches", () => {
  assert.deepEqual(suggestStarterTopics("We Were Wrong About Compound Interest", ""), ["Finance"]);
  assert.deepEqual(suggestStarterTopics("Three recipes for a weeknight", ""), ["Food"]);
});

test("orders the strongest first", () => {
  assert.deepEqual(suggestStarterTopics("Sleep and training", "Recovery, muscle, gym and a better workout."), ["Fitness", "Health"]);
});

test("one passing word in the text isn't enough to suggest a topic", () => {
  assert.deepEqual(suggestStarterTopics("A quiet morning", "We talked about the garden for a minute."), []);
});

test("offers at most three, and nothing when nothing fits", () => {
  assert.equal(suggestStarterTopics("AI, money, sleep, chess and football", "").length, 3);
  assert.deepEqual(suggestStarterTopics("Untitled", "Lorem ipsum dolor sit amet."), []);
});

test("matches whole words, so a term inside another word doesn't count", () => {
  assert.deepEqual(suggestStarterTopics("Startup art", ""), ["Business", "Design"]);
  assert.deepEqual(suggestStarterTopics("Restarting", ""), []);
});
