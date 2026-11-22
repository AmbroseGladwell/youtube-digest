import type { OnboardingFound } from "../onboardingSources.js";

export type OnboardingKind = "video" | "article" | "recipe" | "podcast";

// What onboarding's link turned out to be once it's read: a recipe page or a video checked as one
// is a recipe (327s, 327u-2).
export function onboardingKindOf(found: OnboardingFound): OnboardingKind {
  if (found.recipe !== null || found.noteKind === "recipe") {
    return "recipe";
  }
  if (found.source.kind === "web") {
    return "article";
  }
  return found.source.kind === "podcast" ? "podcast" : "video";
}
