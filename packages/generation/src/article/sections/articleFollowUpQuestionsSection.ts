import { followUpQuestionsInstructions, followUpQuestionsShape } from "../../sections/followUpQuestionsSection.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";

export const articleFollowUpQuestionsSection: ArticlePromptSection = {
  key: "structural",
  prompt: (input) => followUpQuestionsInstructions("article", input.readerContext, input.sectionsEnabled.howToApply),
  schemaShape: followUpQuestionsShape,
};

export const recipePageFollowUpQuestionsSection: ArticlePromptSection = {
  ...articleFollowUpQuestionsSection,
  prompt: (input) => followUpQuestionsInstructions("recipe", input.readerContext, false),
};
