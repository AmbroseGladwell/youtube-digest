import { articleSourceId, type Overview, type OverviewId } from "@overview/domain";
import { requestGeneratedOutput, type GenerationClient, type GenerationObserver } from "../generateOverview.js";
import { filedProjectIds } from "../sections/projectInstructions.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { assembleArticleOverview, type GeneratedArticleOutput } from "./assembleArticleOverview.js";
import { composeArticlePrompt } from "./composeArticlePrompt.js";

export async function generateArticleOverview(
  client: GenerationClient,
  input: ArticleGenerationInput,
  meta: { id: OverviewId; savedAt: string },
  observer: GenerationObserver = {},
): Promise<Overview> {
  const output = await requestGeneratedOutput<GeneratedArticleOutput>(client, composeArticlePrompt(input));
  observer.projectsFiled?.(filedProjectIds(input.existingProjects, output.matchedProjectNames));
  return assembleArticleOverview(input, output, { ...meta, sourceId: await articleSourceId(input.article.url) });
}
