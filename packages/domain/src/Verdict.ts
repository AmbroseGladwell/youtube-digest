import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { TimeRange } from "./WatchAnyway.js";

export const Novelty = z.enum(["common_knowledge", "fresh_angle", "original"]);
export type Novelty = z.infer<typeof Novelty>;

export const SimilarOverview = z.object({
  overviewId: OverviewId,
  title: z.string(),
});
export type SimilarOverview = z.infer<typeof SimilarOverview>;

export const StandsOut = z.object({
  text: z.string(),
  range: TimeRange.nullable(),
});
export type StandsOut = z.infer<typeof StandsOut>;

export const Verdict = z.object({
  novelty: Novelty,
  standsOut: StandsOut.nullable(),
  dubious: z.boolean(),
  reasoning: z.string(),
  similarTo: z.array(SimilarOverview),
});
export type Verdict = z.infer<typeof Verdict>;
