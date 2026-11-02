import test from "node:test";
import assert from "node:assert/strict";
import { sourceKey, storedSourceKey } from "./sourceKey.js";

test("a YouTube key is the bare id, so every row keyed before sources existed still answers", () => {
  assert.equal(sourceKey({ kind: "youtube", id: "tL9Lw250spc" }), "tL9Lw250spc");
});

test("any other kind is prefixed, so the same id under two kinds is two items", () => {
  assert.equal(sourceKey({ kind: "web", id: "tL9Lw250spc" }), "web:tL9Lw250spc");
});

test("a note from before transcripts were stored against an id has no key", () => {
  assert.equal(sourceKey({ kind: "youtube", id: null }), null);
});

test("a stored body gives its key at either shape", () => {
  assert.equal(storedSourceKey({ video: { id: "abc" } }), "abc");
  assert.equal(storedSourceKey({ source: { kind: "youtube", id: "abc" } }), "abc");
  assert.equal(storedSourceKey({ source: { kind: "web", id: "abc" } }), "web:abc");
});

test("a stored body with no usable id has no key", () => {
  for (const body of [null, "text", {}, { video: { id: null } }, { source: { kind: "youtube", id: null } }]) {
    assert.equal(storedSourceKey(body), null);
  }
});
