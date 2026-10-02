import { z } from "zod";
import type { NoteLine } from "./NoteLine.js";
import type { SharedNote } from "./SharedNote.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { speakable } from "./speakable.js";

// One entry per NoteLine, headings included, so an audio timing is a line index, and an
// empty entry is a line shown but not spoken (docs/features/tts-pre-rendered-speech.md,
// "The spoken script").
export const MAX_SPOKEN_SCRIPT_CHARACTERS = 20_000;

export const SpokenScript = z
  .array(z.string().trim())
  .min(1)
  .refine((lines) => lines.some((line) => line !== ""), { message: "A spoken script says something" })
  .refine(
    (lines) => lines.reduce((total, line) => total + line.length, 0) <= MAX_SPOKEN_SCRIPT_CHARACTERS,
    { message: `A spoken script is at most ${MAX_SPOKEN_SCRIPT_CHARACTERS} characters` },
  );
export type SpokenScript = z.infer<typeof SpokenScript>;

export function spokenLines(lines: NoteLine[]): SpokenScript {
  return lines.map((line) => speakable(line.spoken ?? line.text));
}

export function spokenScript(overview: SharedNote): SpokenScript {
  return spokenLines(overviewNoteLines(overview));
}
