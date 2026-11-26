import test from "node:test";
import assert from "node:assert/strict";
import { spreadAcrossTopics } from "./spreadAcrossTopics.js";

const items = [
  { name: "sleep-a", topics: ["sleep"] },
  { name: "sleep-b", topics: ["sleep", "focus"] },
  { name: "money", topics: ["money"] },
  { name: "focus", topics: ["focus"] },
  { name: "none", topics: [] },
];
const names = (picked: readonly { name: string }[]) => picked.map((item) => item.name);

test("a pair on a topic not yet taken comes before a better-placed one on a taken topic", () => {
  assert.deepEqual(names(spreadAcrossTopics(items, (item) => item.topics, 3)), ["sleep-a", "money", "focus"]);
});

test("once every topic is taken, the rest fill in their own order", () => {
  assert.deepEqual(names(spreadAcrossTopics(items, (item) => item.topics, 5)), ["sleep-a", "money", "focus", "none", "sleep-b"]);
});

test("topics already on show count as taken", () => {
  assert.deepEqual(names(spreadAcrossTopics(items, (item) => item.topics, 2, ["sleep", "money"])), ["focus", "none"]);
});

test("never more than the limit, and nothing from nothing", () => {
  assert.equal(spreadAcrossTopics(items, (item) => item.topics, 0).length, 0);
  assert.deepEqual(
    spreadAcrossTopics([], () => [], 3),
    [],
  );
});
