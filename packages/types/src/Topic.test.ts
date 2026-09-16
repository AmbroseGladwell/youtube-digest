import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Topic } from "./Topic.js";

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
