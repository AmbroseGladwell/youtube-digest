import test from "node:test";
import assert from "node:assert/strict";
import { codeFromHash, copyCodeLink } from "./copyCodeLink.js";

test("the copy link carries the code in the fragment, and the page reads it back", () => {
  const link = copyCodeLink("https://overview.example/", "95J9-Q8TT");
  assert.equal(link, "https://overview.example/code#95J9-Q8TT");
  assert.equal(codeFromHash(new URL(link).hash), "95J9-Q8TT");
});

test("anything that isn't a code reads as none", () => {
  assert.equal(codeFromHash(""), null);
  assert.equal(codeFromHash("#<script>"), null);
  assert.equal(codeFromHash("#95j9q8tt"), "95J9Q8TT");
});
