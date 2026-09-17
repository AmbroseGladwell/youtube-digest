import { z } from "zod";
import { OverviewId } from "./Brands.js";

export const Novelty = z.enum(["novel", "established", "recycled"]);
export type Novelty = z.infer<typeof Novelty>;

export const SimilarOverview = z.object({
  overviewId: OverviewId,
  title: z.string(),
});
export type SimilarOverview = z.infer<typeof SimilarOverview>;

export const Verdict = z.object({
  novelty: Novelty,
  dubious: z.boolean(),
  reasoning: z.string(),
  similarTo: z.array(SimilarOverview),
});
export type Verdict = z.infer<typeof Verdict>;
