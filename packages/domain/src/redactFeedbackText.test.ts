import test from "node:test";
import assert from "node:assert/strict";
import { redactFeedbackText } from "./redactFeedbackText.js";

const FAKE_TOKEN = ["Zx81kQ0p", "Lm2nB7vC", "4tY9rWq"].join("");
const FAKE_KEY = ["sk", "ant", "x", "abcDEF123456ghiJKL789"].join("-");

test("an email address is removed, as it is from an error", () => {
  assert.equal(redactFeedbackText("Write to me at reader@example.com please"), "Write to me at <email> please");
});

test("anything shaped like a key or a token is removed, in a link or on its own", () => {
  assert.equal(redactFeedbackText(`My key ${FAKE_KEY} stopped working`), "My key <key> stopped working");
  assert.equal(
    redactFeedbackText(`This link https://theoverview.app/auth?token=${FAKE_TOKEN} failed`),
    "This link https://theoverview.app/auth?token=<key> failed",
  );
});

test("titles in quotes, links, video ids and ordinary words are kept, because they are what the feedback is about", () => {
  const text = `The verdict on "How I learned to stop worrying" was wrong: https://www.youtube.com/watch?v=dQw4w9WgXcQ at 12:40`;
  assert.equal(redactFeedbackText(text), text);
});

test("surrounding space is trimmed", () => {
  assert.equal(redactFeedbackText("  an idea  \n"), "an idea");
});
