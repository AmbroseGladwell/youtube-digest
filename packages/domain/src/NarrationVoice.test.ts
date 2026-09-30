import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NARRATION_VOICE,
  NarrationVoice,
  narrationAccent,
  narrationLanguage,
  narrationVoiceName,
} from "./NarrationVoice.js";

test("offers the fifteen shortlisted English voices and nothing else", () => {
  assert.equal(NarrationVoice.options.length, 15);
  assert.ok(NarrationVoice.options.every((voice) => /^[ab][fm]_/.test(voice)));
  assert.equal(NarrationVoice.safeParse("ff_siwis").success, false);
  assert.equal(NarrationVoice.safeParse("am_santa").success, false);
});

test("defaults to af_heart", () => {
  assert.equal(DEFAULT_NARRATION_VOICE, "af_heart");
});

test("names each voice by its friendly name rather than Kokoro's id", () => {
  assert.equal(narrationVoiceName("af_heart"), "Heart");
  assert.equal(narrationVoiceName("bm_george"), "George");
});

test("speaks American voices as en-us and British ones as en-gb", () => {
  assert.equal(narrationAccent("bf_emma"), "british");
  assert.equal(narrationLanguage("af_heart"), "en-us");
  assert.equal(narrationLanguage("am_michael"), "en-us");
  assert.equal(narrationLanguage("bf_emma"), "en-gb");
  assert.equal(narrationLanguage("bm_george"), "en-gb");
});
