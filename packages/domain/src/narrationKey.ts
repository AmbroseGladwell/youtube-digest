import type { NarrationVoice } from "./NarrationVoice.js";

// Must match RENDER_VERSION in services/tts/src/overview_tts/render_script.py, which refuses
// any other; bump both when what a render makes changes without the words changing
// (docs/features/tts-pre-rendered-speech.md, "The service").
export const NARRATION_RENDER_VERSION = 1;

export const NARRATION_KEY_PATTERN = /^[0-9a-f]{64}$/;

// What the key is a hash of. The server hashes it with node:crypto; a client that wants to
// ask whether narration exists without queueing any hashes the same text with WebCrypto
// (docs/features/tts-pre-rendered-speech.md, "The API side").
export function narrationKeySource(
  lines: readonly string[],
  voice: NarrationVoice | string,
  renderVersion: number = NARRATION_RENDER_VERSION,
): string {
  return JSON.stringify([renderVersion, voice, lines]);
}

export async function narrationKey(
  lines: readonly string[],
  voice: NarrationVoice | string,
  renderVersion: number = NARRATION_RENDER_VERSION,
): Promise<string> {
  const bytes = new TextEncoder().encode(narrationKeySource(lines, voice, renderVersion));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
