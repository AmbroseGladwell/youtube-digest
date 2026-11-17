import { z } from "zod";
import { Plan } from "./Plan.js";
import { TranscriptionUsage } from "./PodcastTranscription.js";

const Allowance = z.object({ used: z.number().int().min(0), limit: z.number().int().min(0) });

// An account's two counts for this UTC month, as the server keeps them. `resetsOn` is the
// first of the next month, the date the reader is shown (docs/architecture/tiers.md).
// `transcription` only where the server transcribes episodes (docs/features/speech-to-text.md).
export const OverviewUsage = z.object({
  plan: Plan,
  resetsOn: z.iso.date(),
  ours: Allowance,
  own: Allowance,
  transcription: TranscriptionUsage.optional(),
});
export type OverviewUsage = z.infer<typeof OverviewUsage>;
