import { z } from "zod";

// The screens of onboarding after Start, in the order a reader meets them (OV-327, designs
// 327a–327m). Start is the home page's own field, and there is no reveal: the wait opens the
// overview's own page. "video" is Your link for every kind, and the three moments
// ("saving", "knowledgeBase", "stepsForYou") add no stepper segment (docs/features/onboarding.md).
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
