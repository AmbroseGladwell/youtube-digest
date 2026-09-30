import test from "node:test";
import assert from "node:assert/strict";
import { wrapToWidth } from "./wrapToWidth.js";

// One unit of width per character, so a test can say what fits without a font.
const measure = (line: string) => line.length;

test("a title that fits stays on one line", () => {
  assert.deepEqual(wrapToWidth({ text: "Nuclear baseload", maxWidth: 20, maxLines: 3, measure }), [
    "Nuclear baseload",
  ]);
});

test("a title too wide breaks between words, never inside one", () => {
  const lines = wrapToWidth({ text: "The quiet return of nuclear baseload", maxWidth: 16, maxLines: 3, measure });

  assert.deepEqual(lines, ["The quiet return", "of nuclear", "baseload"]);
});

test("what will not fit in the lines there are ends in an ellipsis rather than being dropped in silence", () => {
  const lines = wrapToWidth({ text: "The quiet return of nuclear baseload", maxWidth: 16, maxLines: 2, measure });

  assert.equal(lines.length, 2);
  assert.match(lines[1]!, /…$/);
  assert.ok(measure(lines[1]!) <= 16);
});

test("a single word wider than the line overhangs rather than being chopped mid-word", () => {
  assert.deepEqual(wrapToWidth({ text: "Unmaintainability", maxWidth: 5, maxLines: 2, measure }), [
    "Unmaintainability",
  ]);
});

test("runs of whitespace are one break, and an empty title is no lines at all", () => {
  assert.deepEqual(wrapToWidth({ text: "  a   b  ", maxWidth: 10, maxLines: 2, measure }), ["a b"]);
  assert.deepEqual(wrapToWidth({ text: "   ", maxWidth: 10, maxLines: 2, measure }), []);
});
