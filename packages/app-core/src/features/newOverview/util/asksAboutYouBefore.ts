import { aboutYouIsEmpty, type Settings } from "@overview/domain";
import type { AboutToWrite } from "../api/generationPipeline.js";

// Never a recipe, whose note has nothing written for the reader: docs/features/personalisation.md, "Asked once more".
export const asksAboutYouBefore = async (about: AboutToWrite): Promise<boolean> => {
  switch (about.kind) {
    case "podcast":
      return true;
    case "article":
      return !about.recipe;
    case "video":
      return (await about.noteKind()) !== "recipe";
  }
};

export const aboutYouAskDue = (settings: Pick<Settings, "aboutYou" | "aboutYouAskedAfterOnboarding">): boolean =>
  !settings.aboutYouAskedAfterOnboarding && aboutYouIsEmpty(settings.aboutYou);
