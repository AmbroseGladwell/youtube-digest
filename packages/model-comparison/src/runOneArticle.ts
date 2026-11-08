import { DEFAULT_SECTIONS_ENABLED, type ExtractedArticle } from "@overview/domain";
import { generateArticleOverview, type ArticleGenerationInput } from "@overview/generation";
import type { ComparedModel } from "./ComparedModel.js";
import type { RunRecord } from "./RunRecord.js";
import { runGeneration } from "./runOne.js";

export interface RunOneArticleOptions {
  model: ComparedModel;
  apiKey: string;
  article: ExtractedArticle;
  http?: typeof fetch;
  now?: () => number;
}

export const articleComparisonInput = (article: ExtractedArticle): ArticleGenerationInput => ({
  article,
  captureReason: null,
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
});

export const runOneArticle = ({ article, ...options }: RunOneArticleOptions): Promise<RunRecord> =>
  runGeneration({
    ...options,
    sourceId: article.url,
    generate: (client, meta) => generateArticleOverview(client, articleComparisonInput(article), meta),
  });
