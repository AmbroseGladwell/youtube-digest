// Must match RENDER_VERSION in services/tts/src/overview_tts/render_script.py; bump both together.
export const NARRATION_RENDER_VERSION = 1;

export const NARRATION_KEY_PATTERN = /^[0-9a-f]{64}$/;

// Hashed by server and WebCrypto alike: docs/features/tts-pre-rendered-speech.md, "The API side".
export const narrationKeySource = (lines: readonly string[], voice: string, renderVersion: number = NARRATION_RENDER_VERSION): string => {
  return JSON.stringify([renderVersion, voice, lines]);
};

export const narrationKey = async (
  lines: readonly string[],
  voice: string,
  renderVersion: number = NARRATION_RENDER_VERSION,
): Promise<string> => {
  const bytes = new TextEncoder().encode(narrationKeySource(lines, voice, renderVersion));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
