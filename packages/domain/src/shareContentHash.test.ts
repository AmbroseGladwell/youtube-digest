import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { shareContentHash } from "./shareContentHash.js";
import { shareSnapshot } from "./shareSnapshot.js";

const noteOf = (overview = makeOverview()) =>
  shareSnapshot({ overview, transcript: null, narration: null }).note;

test("the same note hashes the same however its keys were ordered", async () => {
  const note = noteOf();
  const reordered = Object.fromEntries(Object.entries(note).reverse()) as typeof note;

  assert.equal(await shareContentHash(note), await shareContentHash(reordered));
});

test("editing the note changes the hash", async () => {
  const overview = makeOverview();
  const before = await shareContentHash(noteOf(overview));

  const after = await shareContentHash(noteOf({ ...overview, inOneLine: "A different premise entirely." }));

  assert.notEqual(before, after);
});
