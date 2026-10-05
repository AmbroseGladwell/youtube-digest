import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { wordCount } from "./wordCount.js";

export const Novelty = z.enum(["novel", "established", "recycled"]);
export type Novelty = z.infer<typeof Novelty>;

export const SimilarOverview = z.object({
  overviewId: OverviewId,
  title: z.string(),
});
export type SimilarOverview = z.infer<typeof SimilarOverview>;

export const DubiousBasis = z.enum(["contradictsSettled", "conflictOfInterest"]);
export type DubiousBasis = z.infer<typeof DubiousBasis>;

export const MAX_DUBIOUS_CLAIMS = 3;

export const DubiousClaim = z.object({
  claim: z.string().refine((s) => wordCount(s) <= 30, "docs/features/dubious-reasons.md: max 30 words"),
  basis: DubiousBasis,
  reason: z.string().refine((s) => wordCount(s) <= 40, "docs/features/dubious-reasons.md: max 40 words"),
  startMs: z.number().int().nonnegative().nullable(),
});
export type DubiousClaim = z.infer<typeof DubiousClaim>;

export const Verdict = z
  .object({
    novelty: Novelty,
    dubious: z.boolean(),
    dubiousClaims: z.array(DubiousClaim).max(MAX_DUBIOUS_CLAIMS).nullable(),
    reasoning: z.string(),
    similarTo: z.array(SimilarOverview),
  })
  .refine((verdict) => verdict.dubiousClaims === null || verdict.dubious === verdict.dubiousClaims.length > 0, {
    path: ["dubiousClaims"],
    message: "a verdict is dubious exactly when it names a dubious claim",
  });
export type Verdict = z.infer<typeof Verdict>;
