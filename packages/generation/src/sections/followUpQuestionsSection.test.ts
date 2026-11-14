import test from "node:test";
import assert from "node:assert/strict";
import { FollowUpQuestions } from "@overview/domain";
import { followUpQuestionsInstructions, resolvedFollowUpQuestions } from "./followUpQuestionsSection.js";

test("questions lean towards the ideas that matter to the reader, without inventing a life for them", () => {
  const prompt = followUpQuestionsInstructions("video", "I'm a nurse on night shifts.", false);

  assert.match(prompt, /About the reader, for fit: I'm a nurse on night shifts\./);
  assert.match(prompt, /prefer the ones that bear\s+most on their work/);
  assert.match(prompt, /Never give them\s+a new project, role or occasion/);
});

test("a reader question is written only where the connection is real, and none is often right", () => {
  const prompt = followUpQuestionsInstructions("video", "I'm a nurse on night shifts.", false);

  assert.match(prompt, /readerQuestions: up to 3/);
  assert.match(prompt, /only where the connection is real/);
  assert.match(prompt, /just adds "for me" or "in my business" to a general one is forced/);
  assert.match(prompt, /an empty list is often the right answer/);
  assert.match(prompt, /Never ask about an idea one of the other questions already takes/);
});

test("when How to apply already describes the reader, the questions point to it rather than repeat them", () => {
  const prompt = followUpQuestionsInstructions("article", "I'm a nurse on night shifts.", true);

  assert.doesNotMatch(prompt, /night shifts/);
  assert.match(prompt, /described under How to apply/);
});

test("with no reader, the questions are about the source alone", () => {
  const prompt = followUpQuestionsInstructions("recipe", null, false);

  assert.doesNotMatch(prompt, /About the reader|How to apply|readerQuestions/);
  assert.match(prompt, /understand this recipe\s+better/);
});

test("questions are for understanding the source's own ideas, not for checking it", () => {
  const prompt = followUpQuestionsInstructions("video", null, false);

  assert.match(prompt, /one specific idea, term\s+or technique from the video/);
  assert.match(prompt, /for learning, not for checking\s+whether the video is right/);
  assert.match(prompt, /from the note's key points or\s+chapters/);
  assert.match(prompt, /genuinely worth asking/);
});

test("up to nine are asked for, best first, and fewer rather than padding", () => {
  const prompt = followUpQuestionsInstructions("video", null, false);

  assert.match(prompt, /Up to 9 questions/);
  assert.match(prompt, /shown 3 at a\s+time, in your order/);
  assert.match(prompt, /never two questions on the same\s+idea, and never one just to fill the list/);
});

test("the length is a target the model is told, never a count it must hit", () => {
  assert.match(followUpQuestionsInstructions("video", null, false), /about 15 words/);
});

const asked = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}?`);

test("each three gets at most one reader question, second, and the rest are about the source", () => {
  const resolved = resolvedFollowUpQuestions(asked("Source", 9), asked("Reader", 3));

  assert.deepEqual(
    resolved.map(({ question }) => question),
    ["Source 1?", "Reader 1?", "Source 2?", "Source 3?", "Reader 2?", "Source 4?", "Source 5?", "Reader 3?", "Source 6?"],
  );
  assert.ok(FollowUpQuestions.safeParse(resolved).success);
});

test("with no reader question that fits, every question is about the source", () => {
  const resolved = resolvedFollowUpQuestions(asked("Source", 9), []);

  assert.equal(resolved.length, 9);
  assert.ok(resolved.every(({ forReader }) => !forReader));
});

test("one fitting reader question goes in the first three, and later sets stay on the source", () => {
  const resolved = resolvedFollowUpQuestions(asked("Source", 5), ["Reader 1?"]);

  assert.deepEqual(
    resolved.map(({ forReader }) => forReader),
    [false, true, false, false, false, false],
  );
});

test("reader questions never outnumber the source: a set is never made of reader questions alone", () => {
  assert.deepEqual(resolvedFollowUpQuestions([], asked("Reader", 3)), []);
  assert.deepEqual(
    resolvedFollowUpQuestions(["Source 1?"], asked("Reader", 3)).map(({ question }) => question),
    ["Source 1?", "Reader 1?"],
  );
});

test("a blank or over-long question is dropped rather than failing the note", () => {
  const long = Array(26).fill("word").join(" ");

  assert.deepEqual(
    resolvedFollowUpQuestions(["  Is the keeper test fair?  ", "", long, "Would it work on a team of three?"], [long, " "]),
    [
      { question: "Is the keeper test fair?", forReader: false },
      { question: "Would it work on a team of three?", forReader: false },
    ],
  );
});

test("the record refuses two reader questions in one three", () => {
  const twoInOne = [
    { question: "A?", forReader: true },
    { question: "B?", forReader: true },
    { question: "C?", forReader: false },
  ];

  assert.ok(!FollowUpQuestions.safeParse(twoInOne).success);
});
