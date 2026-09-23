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
