import test from "node:test";
import assert from "node:assert/strict";
import { Settings, DEFAULT_SETTINGS, DEFAULT_SECTIONS_ENABLED } from "./Settings.js";

test("the default settings validate against the Settings schema", () => {
  assert.doesNotThrow(() => Settings.parse(DEFAULT_SETTINGS));
});

test("every section defaults to enabled, matching current behaviour", () => {
  assert.deepEqual(DEFAULT_SECTIONS_ENABLED, {
    verdict: true,
    selling: true,
    howToApply: true,
    watchAnyway: true,
  });
});

test("the narration voice starts as Heart", () => {
  assert.equal(DEFAULT_SETTINGS.narrationVoice, "af_heart");
});

test("a voice this client does not offer reads as the default rather than taking the settings with it", () => {
  const read = Settings.parse({ ...DEFAULT_SETTINGS, readerContext: "a parent", narrationVoice: "af_sky" });

  assert.equal(read.narrationVoice, "af_heart");
  assert.equal(read.readerContext, "a parent");
});

test("milestones start empty, and marks this client cannot read take nothing else with them", () => {
  assert.deepEqual(DEFAULT_SETTINGS.milestones, {});

  const read = Settings.parse({ ...DEFAULT_SETTINGS, readerContext: "a parent", milestones: { "30m": "garbled" } });

  assert.deepEqual(read.milestones, {});
  assert.equal(read.readerContext, "a parent");
});

test("a milestone this client does not know survives a read", () => {
  const mark = { crossedAt: "2026-10-01T09:00:00.000Z", dismissedAt: null };

  assert.deepEqual(Settings.parse({ ...DEFAULT_SETTINGS, milestones: { "200h": mark } }).milestones, { "200h": mark });
});

test("milestone cards show unless turned off, and a record from before the switch reads as on", () => {
  assert.equal(DEFAULT_SETTINGS.showMilestoneCards, true);

  const { showMilestoneCards: _, ...older } = DEFAULT_SETTINGS;

  assert.equal(Settings.parse(older).showMilestoneCards, true);
  assert.equal(Settings.parse({ ...DEFAULT_SETTINGS, showMilestoneCards: false }).showMilestoneCards, false);
});

test("usage is shared unless the account turned it off, and a record from before the switch reads as sharing", () => {
  assert.equal(DEFAULT_SETTINGS.analyticsOptOut, false);

  const { analyticsOptOut: _, analyticsOptOutChangedAt: __, ...older } = DEFAULT_SETTINGS;

  assert.equal(Settings.parse(older).analyticsOptOut, false);
  assert.equal(Settings.parse(older).analyticsOptOutChangedAt, null);
  const off = Settings.parse({ ...DEFAULT_SETTINGS, analyticsOptOut: true, analyticsOptOutChangedAt: "2026-10-04T09:00:00.000Z" });
  assert.equal(off.analyticsOptOut, true);
  assert.equal(off.analyticsOptOutChangedAt, "2026-10-04T09:00:00.000Z");
});
