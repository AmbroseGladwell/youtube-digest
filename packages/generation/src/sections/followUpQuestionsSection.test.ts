import test from "node:test";
import assert from "node:assert/strict";
import { followUpQuestionsInstructions, resolvedFollowUpQuestions } from "./followUpQuestionsSection.js";

test("questions are fitted to the reader, with the rule not to invent a life for them", () => {
  const prompt = followUpQuestionsInstructions("video", "I'm a nurse on night shifts.", false);

  assert.match(prompt, /About the reader, for fit: I'm a nurse on night shifts\./);
  assert.match(prompt, /Never give them a new\s+project,\s+role or occasion/);
});

test("when How to apply already describes the reader, the questions point to it rather than repeat them", () => {
  const prompt = followUpQuestionsInstructions("article", "I'm a nurse on night shifts.", true);

  assert.doesNotMatch(prompt, /night shifts/);
  assert.match(prompt, /described under How to apply/);
});

test("with no reader, the questions are about the source alone", () => {
  const prompt = followUpQuestionsInstructions("recipe", null, false);

  assert.doesNotMatch(prompt, /About the reader|How to apply|Fit them/);
  assert.match(prompt, /go further with this recipe/);
});

test("the length is a target the model is told, never a count it must hit", () => {
  assert.match(followUpQuestionsInstructions("video", null, false), /about 15 words/);
});

test("a blank or over-long question is dropped rather than failing the note, and only three are kept", () => {
  const long = Array(26).fill("word").join(" ");

  assert.deepEqual(
    resolvedFollowUpQuestions(["  Is the keeper test fair?  ", "", long, "Would it work on a team of three?", "One more?", "And another?"]),
    ["Is the keeper test fair?", "Would it work on a team of three?", "One more?"],
  );
});
