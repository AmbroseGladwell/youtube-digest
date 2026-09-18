import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Topic, sameTopicName } from "./Topic.js";

test("a topic with no description is valid", () => {
  assert.doesNotThrow(() =>
    Topic.parse({
      id: randomUUID(),
      name: "fitness",
      description: null,
      createdAt: new Date().toISOString(),
    }),
  );
});

test("topic names match on casing and surrounding space, so one topic is never created twice", () => {
  assert.equal(sameTopicName("fitness", " Fitness "), true);
  assert.equal(sameTopicName("fitness", "fitness tips"), false);
});
