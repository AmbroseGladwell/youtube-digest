import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NARRATION_KEY_PATTERN, narrationKey, narrationKeySource } from "./narrationKey.js";

const LINES = ["Verdict", "Recycled.", "Standard advice."];

test("the key a client computes is the SHA-256 of the same source the server hashes", async () => {
  const expected = createHash("sha256").update(narrationKeySource(LINES, "af_heart")).digest("hex");

  assert.equal(await narrationKey(LINES, "af_heart"), expected);
  assert.match(expected, NARRATION_KEY_PATTERN);
});

test("another voice, another render version or other words make another key", async () => {
  const key = await narrationKey(LINES, "af_heart", 1);

  assert.notEqual(await narrationKey(LINES, "bf_emma", 1), key);
  assert.notEqual(await narrationKey(LINES, "af_heart", 2), key);
  assert.notEqual(await narrationKey(["Verdict", "Recycled. Standard advice."], "af_heart", 1), key);
});
