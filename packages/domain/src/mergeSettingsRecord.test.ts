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

test("a patch to one milestone leaves the others, so two devices can each record their own", () => {
  const crossed = { crossedAt: "2026-10-01T09:00:00.000Z", dismissedAt: null };
  const merged = mergeSettingsRecord(
    { milestones: { "30m": crossed, "1h": crossed } },
    { milestones: { "30m": { ...crossed, dismissedAt: "2026-10-01T10:00:00.000Z" } } },
  );
  assert.deepEqual(merged, {
    milestones: { "30m": { ...crossed, dismissedAt: "2026-10-01T10:00:00.000Z" }, "1h": crossed },
  });
});
