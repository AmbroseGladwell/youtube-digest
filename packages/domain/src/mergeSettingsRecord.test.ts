import assert from "node:assert/strict";
import test from "node:test";
import { mergeSettingsRecord } from "./mergeSettingsRecord.js";

test("a patch to one toggle leaves the toggles it did not name, this client's and a newer one's alike", () => {
  const merged = mergeSettingsRecord(
    { sectionsEnabled: { verdict: true, selling: true, chapters: false }, readerContext: "x" },
    { sectionsEnabled: { verdict: false } },
  );
  assert.deepEqual(merged, {
    sectionsEnabled: { verdict: false, selling: true, chapters: false },
    readerContext: "x",
  });
});

test("a patch that does not mention sectionsEnabled leaves it exactly as it was", () => {
  const merged = mergeSettingsRecord({ sectionsEnabled: { verdict: false }, readerContext: null }, { readerContext: "y" });
  assert.deepEqual(merged, { sectionsEnabled: { verdict: false }, readerContext: "y" });
});
