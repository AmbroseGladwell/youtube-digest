import { createHash } from "node:crypto";
import { NARRATION_KEY_PATTERN, NARRATION_RENDER_VERSION, narrationKeySource } from "@overview/domain";

export const TTS_RENDER_VERSION = NARRATION_RENDER_VERSION;

export const AUDIO_KEY_PATTERN = NARRATION_KEY_PATTERN;

export function audioKey(lines: readonly string[], voice: string, renderVersion: number = TTS_RENDER_VERSION): string {
  return createHash("sha256").update(narrationKeySource(lines, voice, renderVersion)).digest("hex");
}
