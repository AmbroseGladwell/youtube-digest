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
