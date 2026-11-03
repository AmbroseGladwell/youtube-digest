import type { Overview, OverviewId } from "@overview/domain";
import { generateOverview, type GenerationClient } from "../generateOverview.js";
import type { GenerationInput } from "../GenerationInput.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { generateArticleOverview } from "./generateArticleOverview.js";

export type OverviewInput = GenerationInput | ArticleGenerationInput;

export const generateOverviewOf = (
  client: GenerationClient,
  input: OverviewInput,
  meta: { id: OverviewId; savedAt: string },
): Promise<Overview> => ("article" in input ? generateArticleOverview(client, input, meta) : generateOverview(client, input, meta));
