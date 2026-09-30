import test from "node:test";
import assert from "node:assert/strict";
import { Overview } from "./Overview.js";
import { PRIVATE_OVERVIEW_FIELDS, SHARED_NOTE_FIELDS } from "./SharedNote.js";

test("a shared copy carries every field of an overview except the reader's own three", () => {
  const expected = Object.keys(Overview.shape)
    .filter((field) => !PRIVATE_OVERVIEW_FIELDS.includes(field as (typeof PRIVATE_OVERVIEW_FIELDS)[number]))
    .sort();

  assert.deepEqual(SHARED_NOTE_FIELDS, expected);
});
