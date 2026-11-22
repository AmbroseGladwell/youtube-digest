import { z } from "zod";

export const ConsentAnswer = z.enum(["share", "dontShare"]);
export type ConsentAnswer = z.infer<typeof ConsentAnswer>;

// Kept whoever signs in: docs/features/analytics-consent.md, "The record".
export const AnalyticsConsent = z.object({
  answer: ConsentAnswer,
  answeredAt: z.iso.datetime(),
  purposesVersion: z.number().int().positive(),
  anonymousId: z.uuid().nullable(),
});
export type AnalyticsConsent = z.infer<typeof AnalyticsConsent>;
