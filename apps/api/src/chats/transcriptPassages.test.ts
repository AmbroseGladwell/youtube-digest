import test from "node:test";
import assert from "node:assert/strict";
import { transcriptPassages } from "./transcriptPassages.js";

test("passages close once a minute has passed since their first segment", () => {
  const segments = [
    { text: "Creatine is a backup", startMs: 0, endMs: 4_000 },
    { text: "store of energy.", startMs: 4_000, endMs: 8_000 },
    { text: "Take three to five grams", startMs: 61_000, endMs: 65_000 },
    { text: "a day, with training.", startMs: 65_000, endMs: 70_000 },
  ];
  assert.deepEqual(transcriptPassages(segments), [
    { id: "p1", startMs: 0, endMs: 8_000, text: "Creatine is a backup store of energy." },
    { id: "p2", startMs: 61_000, endMs: 70_000, text: "Take three to five grams a day, with training." },
  ]);
  assert.deepEqual(transcriptPassages([]), []);
});
