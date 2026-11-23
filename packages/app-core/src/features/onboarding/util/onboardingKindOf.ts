import { isWrittenSource } from "@overview/domain";
import type { OnboardingFound } from "../onboardingSources.js";

export type OnboardingKind = "video" | "article" | "recipe" | "podcast";

export const onboardingKindOf = (found: OnboardingFound): OnboardingKind => {
  if (found.recipe !== null || found.noteKind === "recipe") {
    return "recipe";
  }
  if (isWrittenSource(found.source)) {
    return "article";
  }
  return found.source.kind === "podcast" ? "podcast" : "video";
};
