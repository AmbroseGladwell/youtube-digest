import test from "node:test";
import assert from "node:assert/strict";
import { howToApplyInstructions } from "./howToApplySection.js";

test("a reader's context comes with the rule to fit their life, not invent one", () => {
  const prompt = howToApplyInstructions("I'm a nurse.");

  assert.match(prompt, /About the reader, for fit: I'm a nurse\./);
  assert.match(prompt, /Never give them a new\s+project, role or occasion/);
});

test("with no reader, there is nothing to fit and no rule about it", () => {
  const prompt = howToApplyInstructions(null);

  assert.doesNotMatch(prompt, /About the reader/);
  assert.doesNotMatch(prompt, /Never give them a new/);
});
