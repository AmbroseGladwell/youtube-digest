import { z } from "zod";

// The screens of onboarding after Start, in the order a reader meets them. Start is the home
// page's own field, and the reveal is the overview's own page (docs/features/onboarding.md).
export const OnboardingStep = z.enum([
  "analytics",
  "video",
  "topics",
  "library",
  "aboutYou",
  "voice",
  "askYourAi",
  "moreSources",
  "account",
  "plan",
]);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const ONBOARDING_STEPS = OnboardingStep.options;
