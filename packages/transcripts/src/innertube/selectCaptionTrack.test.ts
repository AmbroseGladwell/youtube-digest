import test from "node:test";
import assert from "node:assert/strict";
import type { CaptionTrack } from "./PlayerResponse.js";
import { isMachineTranscribed, selectCaptionTrack } from "./selectCaptionTrack.js";

const written = (languageCode: string): CaptionTrack => ({ baseUrl: `w-${languageCode}`, languageCode });
const machine = (languageCode: string): CaptionTrack => ({
  baseUrl: `a-${languageCode}`,
  languageCode,
  kind: "asr",
});

test("a written track wins over a machine-heard one in the same language", () => {
  const track = selectCaptionTrack([machine("en"), written("en")], { allowMachineTranscription: true });

  assert.equal(track?.baseUrl, "w-en");
  assert.equal(isMachineTranscribed(track!), false);
});

test("a written track in another language still wins over a machine-heard one", () => {
  const track = selectCaptionTrack([machine("en"), written("de")], { allowMachineTranscription: true });

  assert.equal(track?.baseUrl, "w-de");
});

test("the requested language is preferred, including a regional variant of it", () => {
  const track = selectCaptionTrack([written("de"), written("en-GB")], {
    lang: "en",
    allowMachineTranscription: true,
  });

  assert.equal(track?.baseUrl, "w-en-GB");
});

test("a machine-heard track is used when it is all there is, and says so", () => {
  const track = selectCaptionTrack([machine("en")], { allowMachineTranscription: true });

  assert.equal(track?.baseUrl, "a-en");
  assert.equal(isMachineTranscribed(track!), true);
});

test("turning machine transcription off leaves a machine-only video with nothing", () => {
  assert.equal(selectCaptionTrack([machine("en")], { allowMachineTranscription: false }), null);
});

test("a video with no tracks selects nothing rather than inventing one", () => {
  assert.equal(selectCaptionTrack([], { allowMachineTranscription: true }), null);
});
