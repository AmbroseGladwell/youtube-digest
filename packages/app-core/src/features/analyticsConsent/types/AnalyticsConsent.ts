import { z } from "zod";

export const ConsentAnswer = z.enum(["share", "dontShare"]);
export type ConsentAnswer = z.infer<typeof ConsentAnswer>;

// What a reader without an account said about sharing usage, when, and to which list of
// what is counted. Kept on the device whoever signs in, because the choice belongs to the
// browser or install; the anonymous id exists only while the answer is yes and no one is
// signed in (docs/features/analytics-consent.md).
export const AnalyticsConsent = z.object({
  answer: ConsentAnswer,
  answeredAt: z.iso.datetime(),
  purposesVersion: z.number().int().positive(),
  anonymousId: z.uuid().nullable(),
});
export type AnalyticsConsent = z.infer<typeof AnalyticsConsent>;
