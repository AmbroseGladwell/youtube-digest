import test from "node:test";
import assert from "node:assert/strict";
import { AUDIO_KEY_PATTERN, audioKey } from "./audioKey.js";

const LINES = ["Verdict", "Recycled.", "Standard advice."];

test("the same words in the same voice always make the same key", () => {
  assert.equal(audioKey(LINES, "af_heart"), audioKey([...LINES], "af_heart"));
  assert.match(audioKey(LINES, "af_heart"), AUDIO_KEY_PATTERN);
});

test("another voice, another render version or other words make another key", () => {
  const key = audioKey(LINES, "af_heart", 1);

  assert.notEqual(audioKey(LINES, "bf_emma", 1), key);
  assert.notEqual(audioKey(LINES, "af_heart", 2), key);
  assert.notEqual(audioKey(["Verdict", "Recycled. Standard advice."], "af_heart", 1), key);
});
