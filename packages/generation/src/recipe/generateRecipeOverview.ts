import { articleSourceId, type Overview, type OverviewId, type Recipe } from "@overview/domain";
import { requestGeneratedOutput, type GenerationClient } from "../generateOverview.js";
import type { ArticleGenerationInput } from "../article/ArticleGenerationInput.js";
import { assembleRecipeOverview, type GeneratedRecipeOutput } from "./assembleRecipeOverview.js";
import { composeRecipePrompt } from "./composeRecipePrompt.js";

export async function generateRecipeOverview(
  client: GenerationClient,
  input: ArticleGenerationInput,
  recipe: Recipe,
  meta: { id: OverviewId; savedAt: string },
): Promise<Overview> {
  const output = await requestGeneratedOutput<GeneratedRecipeOutput>(client, composeRecipePrompt(input, recipe));
  return assembleRecipeOverview(input, recipe, output, { ...meta, sourceId: await articleSourceId(input.article.url) });
}
