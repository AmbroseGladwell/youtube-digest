import assert from "node:assert/strict";
import { test } from "node:test";
import { addedLinesOf, onAddedLines } from "./lintChangedLines.mjs";

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -3,0 +4,2 @@ const a = 1;",
  "+// one",
  "+// two",
  "@@ -10 +12 @@",
  "-old",
  "+new",
  "@@ -20,3 +22,0 @@",
  "diff --git a/src/gone.ts b/src/gone.ts",
  "--- a/src/gone.ts",
  "+++ /dev/null",
  "@@ -1,2 +0,0 @@",
].join("\n");

const FILE = Buffer.from("line1\nline2\n// a\n// b\n// c\nline6\n");

const diagnostic = (line, offset, length) => ({ filename: "src/a.ts", labels: [{ span: { line, offset, length } }] });

test("added lines come from each hunk's new side, and deleted files and pure deletions add none", () => {
  assert.deepEqual(addedLinesOf(DIFF), new Map([["src/a.ts", new Set([4, 5, 12])]]));
});

test("a line moved unchanged within a file isn't new, but an edited one is", () => {
  const moved = [
    "+++ b/src/a.ts",
    "@@ -1,2 +1 @@",
    "-// kept as it was",
    "-// reworded",
    "+interface Moved {",
    "@@ -5 +4,3 @@",
    "-}",
    "+}",
    "+// kept as it was",
    "+// reworded, now",
  ].join("\n");
  assert.deepEqual(addedLinesOf(moved), new Map([["src/a.ts", new Set([1, 6])]]));
});

test("a problem counts when any line of its span was added", () => {
  const added = new Map([["src/a.ts", new Set([5])]]);
  const commentRun = diagnostic(3, 12, 14);
  const above = diagnostic(1, 0, 5);
  assert.deepEqual(
    onAddedLines([commentRun, above], added, () => FILE),
    [commentRun],
  );
});

test("a problem in a file the change doesn't touch is left alone", () => {
  const elsewhere = { filename: "src/b.ts", labels: [{ span: { line: 1, offset: 0, length: 3 } }] };
  assert.deepEqual(
    onAddedLines([elsewhere], new Map([["src/a.ts", new Set([1])]]), () => FILE),
    [],
  );
});
