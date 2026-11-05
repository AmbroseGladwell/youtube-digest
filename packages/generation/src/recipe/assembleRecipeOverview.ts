import { Overview, recipeNote, resolveTags, webSource, type OverviewId, type Recipe, type SourceKey } from "@overview/domain";
import type { ArticleGenerationInput } from "../article/ArticleGenerationInput.js";

export interface GeneratedRecipeOutput {
  inOneLine: string;
  summary: string;
  matchedTopicNames: string[];
  tags: string[];
}

// Everything in the recipe is the page's, copied by code; only the summary and the line come
// from the model (docs/features/recipe-notes.md).
export function assembleRecipeOverview(
  input: ArticleGenerationInput,
  recipe: Recipe,
  output: GeneratedRecipeOutput,
  meta: { id: OverviewId; savedAt: string; sourceId: SourceKey },
): Overview {
  return Overview.parse({
    id: meta.id,
    source: webSource(input.article, meta.sourceId),
    savedAt: meta.savedAt,
    captureReason: input.captureReason,
    fromPlaylist: null,
    madeOn: null,
    inOneLine: output.inOneLine,
    coreClaim: "",
    thin: false,
    keyPoints: [],
    topicIds: input.existingTopics.filter((topic) => output.matchedTopicNames.includes(topic.name)).map((topic) => topic.id),
    tags: resolveTags(output.tags, { known: new Set(input.existingTags.map(({ tag }) => tag)), aliases: input.tagAliases }),
    verdict: null,
    selling: null,
    howToApply: null,
    watchAnyway: null,
    chapters: null,
    article: null,
    recipe: recipeNote(recipe, output.summary),
  });
}
