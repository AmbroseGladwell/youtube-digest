import { z } from "zod";

// In the order a reader meets them; three moments add no stepper segment (docs/features/onboarding.md).
export const OnboardingStep = z.enum([
  "analytics",
  "video",
  "saving",
  "topics",
  "knowledgeBase",
  "stepsForYou",
  "aboutYou",
  "account",
  "wait",
]);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const ONBOARDING_STEPS = OnboardingStep.options;
