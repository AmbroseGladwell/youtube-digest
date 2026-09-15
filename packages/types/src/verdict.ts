import { z } from "zod";

export const Novelty = z.enum(["novel", "competent_not_new", "recycled"]);
export type Novelty = z.infer<typeof Novelty>;

export const SimilarNote = z.object({
  noteId: z.string(),
  title: z.string(),
});
export type SimilarNote = z.infer<typeof SimilarNote>;

export const Verdict = z.object({
  novelty: Novelty,
  dubious: z.boolean(),
  reasoning: z.string(),
  similarTo: z.array(SimilarNote),
});
export type Verdict = z.infer<typeof Verdict>;
