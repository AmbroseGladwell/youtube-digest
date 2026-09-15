import test from "node:test";
import assert from "node:assert/strict";
import { Topic } from "./Topic.js";

test("a topic with no description is valid", () => {
  assert.doesNotThrow(() =>
    Topic.parse({
      id: "t1",
      name: "fitness",
      description: null,
      createdAt: new Date().toISOString(),
    }),
  );
});
