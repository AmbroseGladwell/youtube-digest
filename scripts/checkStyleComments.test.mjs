import assert from "node:assert/strict";
import { test } from "node:test";
import { styleCommentProblems } from "./checkStyleComments.mjs";

test("a one-line comment of either kind is fine", () => {
  assert.deepEqual(styleCommentProblems(".a {\n  // Safari needs the prefix\n  color: red; /* matches the tile */\n}\n"), []);
});

test("two line comments in a row, or a block across lines, run too long", () => {
  const text = "// first\n// second\n.a { color: red; }\n/*\n * block\n */\n.b {}\n";
  assert.deepEqual(styleCommentProblems(text), [
    { line: 1, problem: "long" },
    { line: 4, problem: "long" },
  ]);
});

test("line comments with code between them are separate", () => {
  assert.deepEqual(styleCommentProblems("// one\n.a {}\n// two\n"), []);
});

test("a url or a string holding slashes is not a comment", () => {
  const text = '.a {\n  background: url(https://example.com/x.png);\n  content: "//";\n  mask: url("data:image/svg+xml;utf8,<svg/>");\n}\n';
  assert.deepEqual(styleCommentProblems(text), []);
});

test("a TODO is refused even on one line", () => {
  assert.deepEqual(styleCommentProblems("// TODO: tidy\n.a {}\n"), [{ line: 1, problem: "marker" }]);
});
