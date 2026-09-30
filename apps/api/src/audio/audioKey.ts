import { createHash } from "node:crypto";

// Must match RENDER_VERSION in services/tts/src/overview_tts/render_script.py, which refuses
// any other; bump both when what a render makes changes without the words changing
// (docs/features/tts-pre-rendered-speech.md, "The service").
export const TTS_RENDER_VERSION = 1;

export const AUDIO_KEY_PATTERN = /^[0-9a-f]{64}$/;

export function audioKey(lines: readonly string[], voice: string, renderVersion: number = TTS_RENDER_VERSION): string {
  return createHash("sha256").update(JSON.stringify([renderVersion, voice, lines])).digest("hex");
}
