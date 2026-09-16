import test from "node:test";
import assert from "node:assert/strict";
import { NoteState, DEFAULT_NOTE_STATE } from "./NoteState.js";

test("the default note state (unread, unfavourited, no user tags) validates once a noteId is attached", () => {
  const state: NoteState = { noteId: "n1", ...DEFAULT_NOTE_STATE };
  assert.doesNotThrow(() => NoteState.parse(state));
  assert.equal(state.read, false);
  assert.equal(state.favourite, false);
  assert.deepEqual(state.userTags, []);
});

test("a user tag must be lowercase and hyphenated, same as a model tag", () => {
  assert.doesNotThrow(() =>
    NoteState.parse({ noteId: "n1", ...DEFAULT_NOTE_STATE, userTags: ["re-watch"] }),
  );
  assert.throws(() =>
    NoteState.parse({ noteId: "n1", ...DEFAULT_NOTE_STATE, userTags: ["Re-Watch"] }),
  );
});
