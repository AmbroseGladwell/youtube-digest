import test from "node:test";
import assert from "node:assert/strict";
import { answerBlocks, holdsCodeBlock } from "./answerBlocks.js";

test("reads paragraphs a line each, and a fenced block whole with its lines and indentation", () => {
  assert.deepEqual(answerBlocks("First.\n\nRun this:\n```ts\nconst a = 1;\n  if (a) go();\n```\nThen done."), [
    { kind: "paragraph", text: "First." },
    { kind: "paragraph", text: "Run this:" },
    { kind: "code", language: "ts", code: "const a = 1;\n  if (a) go();" },
    { kind: "paragraph", text: "Then done." },
  ]);
});

test("draws a fence still open as code, as the answer streams in", () => {
  assert.deepEqual(answerBlocks("Like so:\n```\nnpm i"), [
    { kind: "paragraph", text: "Like so:" },
    { kind: "code", language: "", code: "npm i" },
  ]);
});

test("splits a list item's text around its fence, and says which items hold one (OV-372)", () => {
  const item = 'Ban explicit any:\n```js\nrules: {\n  "no-explicit-any": "error",\n}\n```\nThis flags `value: any`.';
  assert.deepEqual(answerBlocks(item), [
    { kind: "paragraph", text: "Ban explicit any:" },
    { kind: "code", language: "js", code: 'rules: {\n  "no-explicit-any": "error",\n}' },
    { kind: "paragraph", text: "This flags `value: any`." },
  ]);
  assert.equal(holdsCodeBlock(item), true);
  assert.equal(holdsCodeBlock("Use `useEffect` sparingly."), false);
});
