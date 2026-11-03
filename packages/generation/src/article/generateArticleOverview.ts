import { articleSourceId, type Overview, type OverviewId } from "@overview/domain";
import { requestGeneratedOutput, type GenerationClient } from "../generateOverview.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { assembleArticleOverview, type GeneratedArticleOutput } from "./assembleArticleOverview.js";
import { composeArticlePrompt } from "./composeArticlePrompt.js";

export async function generateArticleOverview(
  client: GenerationClient,
  input: ArticleGenerationInput,
  meta: { id: OverviewId; savedAt: string },
): Promise<Overview> {
  const output = await requestGeneratedOutput<GeneratedArticleOutput>(client, composeArticlePrompt(input));
  return assembleArticleOverview(input, output, { ...meta, sourceId: await articleSourceId(input.article.url) });
}
