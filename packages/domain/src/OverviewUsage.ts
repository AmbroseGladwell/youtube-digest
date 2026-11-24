import { z } from "zod";
import { Plan } from "./Plan.js";
import { TranscriptionUsage } from "./PodcastTranscription.js";

const Allowance = z.object({ used: z.number().int().min(0), limit: z.number().int().min(0) });

// This UTC month's counts; transcription only where the server transcribes (docs/architecture/tiers.md).
export const OverviewUsage = z.object({
  plan: Plan,
  resetsOn: z.iso.date(),
  ours: Allowance,
  own: Allowance,
  saves: Allowance.optional(),
  transcription: TranscriptionUsage.optional(),
});
export type OverviewUsage = z.infer<typeof OverviewUsage>;
