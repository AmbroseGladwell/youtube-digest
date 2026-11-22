import type { OnboardingFound } from "../onboardingSources.js";

export type OnboardingKind = "video" | "article" | "recipe" | "podcast";

export const onboardingKindOf = (found: OnboardingFound): OnboardingKind => {
  if (found.recipe !== null || found.noteKind === "recipe") {
    return "recipe";
  }
  if (found.source.kind === "web") {
    return "article";
  }
  return found.source.kind === "podcast" ? "podcast" : "video";
};
