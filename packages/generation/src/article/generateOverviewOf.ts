import type { Overview } from "@overview/domain";
import { generateOverview, type GenerationObserver } from "../generateOverview.js";
import { type GenerationClient } from "../requestGeneratedOutput.js";
import type { GenerationInput } from "../GenerationInput.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { generateArticleOverview } from "./generateArticleOverview.js";
import { generateRecipeOverview } from "../recipe/generateRecipeOverview.js";
import { generatePodcastOverview } from "../podcast/generatePodcastOverview.js";
import { isPodcastInput } from "../podcast/PodcastGenerationInput.js";
import type { OverviewMeta } from "../OverviewMeta.js";

export type OverviewInput = GenerationInput | ArticleGenerationInput;

export const generateOverviewOf = (
  client: GenerationClient,
  input: OverviewInput,
  meta: OverviewMeta,
  observer: GenerationObserver = {},
): Promise<Overview> => {
  if (isPodcastInput(input)) {
    return generatePodcastOverview(client, input, meta, observer);
  }
  if (!("article" in input)) {
    return generateOverview(client, input, meta, observer);
  }
  const { recipe } = input.article;
  return recipe === null
    ? generateArticleOverview(client, input, meta, observer)
    : generateRecipeOverview(client, input, recipe, meta, observer);
};
