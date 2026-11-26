import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CHUNK_SIZING, speechChunks } from "./speechChunks.js";

const chunked = (sentences: string[], sizing = DEFAULT_CHUNK_SIZING) => speechChunks(sentences, (sentence) => sentence.length, sizing);

const of = (length: number, mark = "x") => mark.repeat(length);

test("a one-word opener joins what follows, so the first chunk is long enough to cover the next one being made", () => {
  const answer = ["Yes.", "Creatine helps most when you train hard, and the effect builds over weeks.", "Take it daily."];

  assert.deepEqual(chunked(answer), [
    ["Yes.", "Creatine helps most when you train hard, and the effect builds over weeks."],
    ["Take it daily."],
  ]);
});

test("each later chunk is at most what the voice makes while the one before plays", () => {
  const chunks = chunked([of(80, "a"), of(100, "b"), of(100, "c"), of(100, "d"), of(100, "e"), of(100, "f")]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.map((sentence) => sentence[0]).join("")),
    ["a", "bc", "def"],
  );
});

test("chunks stop growing at the most, so readers taking turns never wait behind a huge one", () => {
  const chunks = chunked(Array.from({ length: 40 }, () => of(100)));

  assert.ok(chunks.every((chunk) => chunk.length * 100 <= DEFAULT_CHUNK_SIZING.mostCharacters));
});

test("a sentence longer than the budget stays whole in a chunk of its own", () => {
  const chunks = chunked([of(80, "a"), of(900, "b"), of(50, "c")]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.map((sentence) => sentence[0]).join("")),
    ["a", "b", "c"],
  );
});

test("an answer shorter than the first chunk's length is one chunk, and nothing to say is none", () => {
  assert.deepEqual(chunked(["Yes.", "Daily."]), [["Yes.", "Daily."]]);
  assert.deepEqual(chunked([]), []);
});

test("the sizing can follow a slower or faster voice", () => {
  const slow = { firstCharacters: 40, growth: 1, mostCharacters: 600 };

  assert.deepEqual(
    chunked([of(40, "a"), of(40, "b"), of(40, "c")], slow).map((chunk) => chunk.length),
    [1, 1, 1],
  );
});
