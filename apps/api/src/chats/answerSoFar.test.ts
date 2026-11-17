import test from "node:test";
import assert from "node:assert/strict";
import { answerSoFar } from "./answerSoFar.js";

test("the answer is read from a reply still arriving, up to its last whole character", () => {
  const whole = JSON.stringify({ answer: 'Three "to" five\ngrams é', passages: ["p2"], chatMessages: [], inSource: true });
  const seen = Array.from({ length: whole.length + 1 }, (_, end) => answerSoFar(whole.slice(0, end)));
  assert.equal(seen.at(-1), 'Three "to" five\ngrams é');
  assert.ok(
    seen.every((text, index) => index === 0 || text.startsWith(seen[index - 1]!)),
    "the text only ever grows",
  );
  assert.equal(answerSoFar('{"answer":"half an escape \\'), "half an escape ");
  assert.equal(answerSoFar('{"answer":"cut \\u00'), "cut ");
  assert.equal(answerSoFar('{"passages":[]'), "");
});
