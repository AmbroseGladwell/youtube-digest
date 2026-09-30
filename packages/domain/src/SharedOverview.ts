import { z } from "zod";
import { NARRATION_KEY_PATTERN } from "./narrationKey.js";
import { NarrationVoice } from "./NarrationVoice.js";
import { SharedNote } from "./SharedNote.js";
import { StoredTranscript } from "./StoredTranscript.js";

// Narration as the shared page plays it. The key is enough on its own, because
// /api/audio/:key/file is already public and content-addressed, so a visitor hears the
// reader's render without an account and without a second store (docs/features/sharing.md).
export const SharedNarration = z.object({
  key: z.string().regex(NARRATION_KEY_PATTERN),
  voice: NarrationVoice,
  durationSeconds: z.number().positive(),
  lineStartsSeconds: z.array(z.number().nonnegative()),
});
export type SharedNarration = z.infer<typeof SharedNarration>;

// A copy, not a view: what the link serves is frozen at the moment it was made, so editing
// the overview afterwards changes nothing the recipient sees until the reader replaces it.
// When it was shared is not in here — that belongs to the link, which keeps its original
// date when the copy behind it is replaced (docs/features/sharing.md).
export const SharedOverview = z.object({
  note: SharedNote,
  transcript: StoredTranscript.nullable(),
  narration: SharedNarration.nullable(),
});
export type SharedOverview = z.infer<typeof SharedOverview>;
