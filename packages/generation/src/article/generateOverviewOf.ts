import type { Overview, OverviewId } from "@overview/domain";
import { generateOverview, type GenerationClient, type GenerationObserver } from "../generateOverview.js";
import type { GenerationInput } from "../GenerationInput.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { generateArticleOverview } from "./generateArticleOverview.js";
import { generateRecipeOverview } from "../recipe/generateRecipeOverview.js";

export type OverviewInput = GenerationInput | ArticleGenerationInput;

export const generateOverviewOf = (
  client: GenerationClient,
  input: OverviewInput,
  meta: { id: OverviewId; savedAt: string },
  observer: GenerationObserver = {},
): Promise<Overview> => {
  if (!("article" in input)) return generateOverview(client, input, meta, observer);
  const { recipe } = input.article;
  return recipe === null ? generateArticleOverview(client, input, meta) : generateRecipeOverview(client, input, recipe, meta);
};
