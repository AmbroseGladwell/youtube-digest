import assert from "node:assert/strict";
import { test } from "node:test";
import { styleFontSizeProblems } from "./checkStyleFontSizes.mjs";

test("rem, em, percentages, keywords and variables are fine", () => {
  const text =
    ".a {\n  font-size: 0.8125rem;\n  font: 400 1em/1.4 var(--font-body);\n}\n.b { font-size: 120%; }\n.c { font-size: inherit; font-size: $size; }\n";
  assert.deepEqual(styleFontSizeProblems(text), []);
});

test("a px font size is refused, in the longhand or the shorthand", () => {
  const text = ".a {\n  font-size: 15px;\n}\n.b { font: 600 13px/1.2 sans-serif; }\n";
  assert.deepEqual(styleFontSizeProblems(text), [
    { line: 2, value: "15px" },
    { line: 4, value: "600 13px/1.2 sans-serif" },
  ]);
});

test("px beside rem is a floor or a ceiling, and passes", () => {
  assert.deepEqual(styleFontSizeProblems(".a { font-size: max(16px, 1rem); }\n.b { font-size: clamp(0.875rem, 2vw, 24px); }\n"), []);
});

test("px held in a clamp with nothing that follows the setting is refused", () => {
  assert.deepEqual(styleFontSizeProblems(".a { font-size: clamp(14px, 2vw, 18px); }\n"), [{ line: 1, value: "clamp(14px, 2vw, 18px)" }]);
});

test("px in a comment, or on other properties, is left alone", () => {
  assert.deepEqual(styleFontSizeProblems("// font-size: 12px was too small\n.a { width: 280px; line-height: 20px; }\n"), []);
});
