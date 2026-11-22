import { z } from "zod";
import { NARRATION_KEY_PATTERN } from "./narrationKey.js";
import { NarrationVoice } from "./NarrationVoice.js";
import { SharedNote } from "./SharedNote.js";
import { StoredTranscript } from "./StoredTranscript.js";

// The public, content-addressed audio key is enough on its own (docs/features/sharing.md).
export const SharedNarration = z.object({
  key: z.string().regex(NARRATION_KEY_PATTERN),
  voice: NarrationVoice,
  durationSeconds: z.number().positive(),
  lineStartsSeconds: z.array(z.number().nonnegative()),
});
export type SharedNarration = z.infer<typeof SharedNarration>;

// docs/features/sharing.md, "A copy, not a view".
export const SharedOverview = z.object({
  note: SharedNote,
  transcript: StoredTranscript.nullable(),
  narration: SharedNarration.nullable(),
});
export type SharedOverview = z.infer<typeof SharedOverview>;
