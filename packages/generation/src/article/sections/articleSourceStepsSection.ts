import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { sourceStepsInstructions, sourceStepsShapeWithoutPlaces } from "../../sections/sourceStepsSection.js";

export const articleSourceStepsSection: ArticlePromptSection = {
  key: "structural",
  prompt: () => sourceStepsInstructions("article", ""),
  schemaShape: sourceStepsShapeWithoutPlaces,
};
