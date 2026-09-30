import { z } from "zod";
import { NarrationVoice } from "./NarrationVoice.js";

// What GET /api/audio/samples answers: one sample of the same passage per offered voice
// that has been rendered (docs/features/narration-voice.md, "The samples").
export const VoiceSample = z.object({
  voice: NarrationVoice,
  fileUrl: z.string().min(1),
  durationSeconds: z.number().positive(),
});
export type VoiceSample = z.infer<typeof VoiceSample>;
