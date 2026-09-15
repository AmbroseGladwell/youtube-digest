import { z } from "zod";

export const WatchAnswer = z.enum(["yes", "no", "partial"]);
export type WatchAnswer = z.infer<typeof WatchAnswer>;

export const TimeRange = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type TimeRange = z.infer<typeof TimeRange>;

export const WatchAnyway = z
  .object({
    answer: WatchAnswer,
    reason: z.string(),
    range: TimeRange.nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.answer === "partial" && val.range === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["range"],
        message: "a partial answer needs a range",
      });
    }
  });
export type WatchAnyway = z.infer<typeof WatchAnyway>;
