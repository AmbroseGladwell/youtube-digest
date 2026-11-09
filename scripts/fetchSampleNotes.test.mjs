import test from "node:test";
import assert from "node:assert/strict";
import { notesFrom } from "./fetchSampleNotes.mjs";

const sample = (title) => ({ token: "t", note: { source: { title } } });

test("the notes come out in the order the samples were listed", () => {
  const notes = notesFrom({ samples: [sample("First"), sample("Second")] });
  assert.deepEqual(
    notes.map((note) => note.source.title),
    ["First", "Second"],
  );
});

test("an empty list is a failure, not an empty file", () => {
  assert.throws(() => notesFrom({ samples: [] }), /listed no samples/);
  assert.throws(() => notesFrom({}), /listed no samples/);
});

test("a sample with no title is a failure, since the shots pick notes by title", () => {
  assert.throws(() => notesFrom({ samples: [sample("First"), { token: "t", note: {} }] }), /carry no title/);
});
