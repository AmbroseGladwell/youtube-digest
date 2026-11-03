import { z } from "zod";

// How to apply written with no reader, from the finished note, for the reveal's flip
// (design 141o). It needs no transcript (docs/architecture/cost-model.md).
export const ForAnyoneInput = z.object({
  title: z.string(),
  channel: z.string(),
  inOneLine: z.string(),
  coreClaim: z.string(),
  keyPoints: z.array(z.string()),
});
export type ForAnyoneInput = z.infer<typeof ForAnyoneInput>;

export const ForAnyoneResult = z.object({ items: z.array(z.string()) });
export type ForAnyoneResult = z.infer<typeof ForAnyoneResult>;
