import test from "node:test";
import assert from "node:assert/strict";
import { articleBudget, headedParts } from "./articleBudget.js";

const section = (heading: string | null) => ({ heading, anchor: null, text: "Some words here.", links: [] });

test("the text before the first heading is not a headed part", () => {
  assert.equal(headedParts({ sections: [section(null), section("One"), section("Two")] }), 2);
});

test("a short piece the author splits into many parts earns more key points than a slight one", () => {
  const slight = articleBudget({ wordCount: 900, sections: [section(null)] });
  const dense = articleBudget({ wordCount: 900, sections: ["A", "B", "C", "D", "E", "F"].map(section) });
  assert.equal(slight.keyPoints, 4);
  assert.equal(dense.keyPoints, 5);
  assert.equal(dense.mostChapters, 5);
});
