import {
  HowToApply,
  Overview,
  ReadAnyway,
  resolveTags,
  Selling,
  webSource,
  wordCount,
  type DubiousBasis,
  type Novelty,
  type OverviewId,
  type SourceKey,
} from "@overview/domain";
import { GenerationError } from "../GenerationError.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { articleParagraphs, type ArticleParagraph } from "./articleParagraphs.js";
import { bigPictureBudget } from "../bigPictureBudget.js";
import { resolvedBigPicture } from "../sections/bigPicturePrompt.js";
import type { ArticleChapterShape } from "./sections/articleChaptersSection.js";

export interface GeneratedArticleOutput {
  inOneLine: string;
  bigPicture: string;
  coreClaim: string;
  thin: boolean;
  keyPoints: Array<{ text: string; paragraphIndex: number | null }>;
  chapters: ArticleChapterShape[];
  matchedTopicNames: string[];
  tags: string[];
  verdict?: {
    novelty: Novelty;
    standsOut: { text: string; paragraphIndex: number | null } | null;
    dubiousClaims: Array<{ claim: string; basis: DubiousBasis; reason: string; paragraphIndex: number }>;
    reasoning: string;
    similarToIndices: number[];
  };
  selling?: unknown;
  howToApply?: unknown;
  readAnyway?: { answer: string; reason: string; leftOut: string; chapterIndexes: number[] };
}

const chapterHolding = (paragraphIndex: number, chapters: ArticleChapterShape[]): number =>
  chapters.reduce((held, { startParagraphIndex }, index) => (startParagraphIndex <= paragraphIndex ? index : held), 0);

export function assembleArticleOverview(
  input: ArticleGenerationInput,
  output: GeneratedArticleOutput,
  meta: { id: OverviewId; savedAt: string; sourceId: SourceKey },
): Overview {
  const paragraphs = articleParagraphs(input.article);
  const paragraphAt = (index: number): ArticleParagraph => {
    const paragraph = paragraphs[index];
    if (paragraph === undefined) {
      throw new GenerationError(`the model named paragraph ${index} (the article has ${paragraphs.length})`);
    }
    return paragraph;
  };
  const chapters = output.chapters.map(({ title, summary, startParagraphIndex }, index) => {
    const end = output.chapters[index + 1]?.startParagraphIndex ?? paragraphs.length;
    return {
      title,
      summary,
      place: paragraphAt(startParagraphIndex).place,
      wordCount: paragraphs.slice(startParagraphIndex, end).reduce((total, { text }) => total + wordCount(text), 0),
    };
  });
  const verdict = output.thin ? undefined : output.verdict;

  return Overview.parse({
    id: meta.id,
    source: webSource(input.article, meta.sourceId),
    savedAt: meta.savedAt,
    captureReason: input.captureReason,
    fromPlaylist: null,
    madeOn: null,
    inOneLine: output.inOneLine,
    bigPicture: resolvedBigPicture(bigPictureBudget(input.article.wordCount), output.bigPicture),
    coreClaim: output.coreClaim,
    thin: output.thin,
    keyPoints: output.keyPoints.map(({ text }) => ({ text, range: null })),
    topicIds: input.existingTopics.filter((topic) => output.matchedTopicNames.includes(topic.name)).map((topic) => topic.id),
    tags: resolveTags(output.tags, { known: new Set(input.existingTags.map(({ tag }) => tag)), aliases: input.tagAliases }),
    verdict:
      verdict === undefined
        ? null
        : {
            novelty: verdict.novelty,
            standsOut:
              verdict.novelty === "common_knowledge" || verdict.standsOut === null ? null : { text: verdict.standsOut.text, range: null },
            dubious: verdict.dubiousClaims.length > 0,
            dubiousClaims: verdict.dubiousClaims.map(({ claim, basis, reason }) => ({ claim, basis, reason, startMs: null })),
            reasoning: verdict.reasoning,
            similarTo: verdict.similarToIndices.flatMap((index) => {
              const claim = input.pastClaims[index];
              return claim === undefined ? [] : [{ overviewId: claim.overviewId, title: claim.title }];
            }),
          },
    selling: output.selling === undefined ? null : Selling.parse(output.selling),
    howToApply: output.howToApply === undefined ? null : HowToApply.parse(output.howToApply),
    watchAnyway: null,
    chapters: null,
    recipe: null,
    article: {
      chapters,
      keyPointChapters: output.keyPoints.map(({ paragraphIndex }) =>
        paragraphIndex === null ? null : chapterHolding(paragraphAt(paragraphIndex).index, output.chapters),
      ),
      readAnyway: output.readAnyway === undefined ? null : ReadAnyway.parse(output.readAnyway),
    },
  });
}
