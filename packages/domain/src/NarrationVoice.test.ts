import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_NARRATION_VOICE, NarrationVoice, narrationLanguage } from "./NarrationVoice.js";

test("offers Kokoro's 28 English voices and nothing else", () => {
  assert.equal(NarrationVoice.options.length, 28);
  assert.ok(NarrationVoice.options.every((voice) => /^[ab][fm]_/.test(voice)));
  assert.equal(NarrationVoice.safeParse("ff_siwis").success, false);
});

test("defaults to af_heart", () => {
  assert.equal(DEFAULT_NARRATION_VOICE, "af_heart");
});

test("speaks American voices as en-us and British ones as en-gb", () => {
  assert.equal(narrationLanguage("af_heart"), "en-us");
  assert.equal(narrationLanguage("am_michael"), "en-us");
  assert.equal(narrationLanguage("bf_emma"), "en-gb");
  assert.equal(narrationLanguage("bm_george"), "en-gb");
});
