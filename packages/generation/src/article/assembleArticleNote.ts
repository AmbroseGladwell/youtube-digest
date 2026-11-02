import { ArticleNote, HowToApply, ReadAnyway, resolveTags, Selling, type DubiousBasis, type Novelty } from "@overview/domain";
import { GenerationError } from "../GenerationError.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { articleParagraphs, type ArticleParagraph } from "./articleParagraphs.js";
import type { ArticleChapterShape } from "./sections/articleChaptersSection.js";

export interface GeneratedArticleOutput {
  inOneLine: string;
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

export function assembleArticleNote(input: ArticleGenerationInput, output: GeneratedArticleOutput): ArticleNote {
  const paragraphs = articleParagraphs(input.article);
  const paragraphAt = (index: number): ArticleParagraph => {
    const paragraph = paragraphs[index];
    if (paragraph === undefined) {
      throw new GenerationError(`the model named paragraph ${index} (the article has ${paragraphs.length})`);
    }
    return paragraph;
  };
  const placeAt = (index: number | null) => (index === null ? null : paragraphAt(index).place);
  const verdict = output.thin ? undefined : output.verdict;

  return ArticleNote.parse({
    inOneLine: output.inOneLine,
    coreClaim: output.coreClaim,
    thin: output.thin,
    keyPoints: output.keyPoints.map(({ text, paragraphIndex }) => ({ text, place: placeAt(paragraphIndex) })),
    chapters: output.chapters.map(({ title, summary, startParagraphIndex }) => ({
      title,
      summary,
      place: paragraphAt(startParagraphIndex).place,
    })),
    topicIds: input.existingTopics.filter((topic) => output.matchedTopicNames.includes(topic.name)).map((topic) => topic.id),
    tags: resolveTags(output.tags, { known: new Set(input.existingTags.map(({ tag }) => tag)), aliases: input.tagAliases }),
    verdict:
      verdict === undefined
        ? null
        : {
            novelty: verdict.novelty,
            standsOut:
              verdict.novelty === "common_knowledge" || verdict.standsOut === null
                ? null
                : { text: verdict.standsOut.text, place: placeAt(verdict.standsOut.paragraphIndex) },
            dubious: verdict.dubiousClaims.length > 0,
            dubiousClaims: verdict.dubiousClaims.map(({ paragraphIndex, ...claim }) => ({ ...claim, place: placeAt(paragraphIndex) })),
            reasoning: verdict.reasoning,
            similarTo: verdict.similarToIndices.flatMap((index) => {
              const claim = input.pastClaims[index];
              return claim === undefined ? [] : [{ overviewId: claim.overviewId, title: claim.title }];
            }),
          },
    selling: output.selling === undefined ? null : Selling.parse(output.selling),
    howToApply: output.howToApply === undefined ? null : HowToApply.parse(output.howToApply),
    readAnyway:
      output.readAnyway === undefined
        ? null
        : ReadAnyway.parse({
            answer: output.readAnyway.answer,
            reason: output.readAnyway.reason,
            leftOut: output.readAnyway.leftOut,
            sections: output.readAnyway.chapterIndexes.map((index) => {
              const chapter = output.chapters[index];
              if (chapter === undefined) {
                throw new GenerationError(`the model named chapter ${index} (it wrote ${output.chapters.length})`);
              }
              return { title: chapter.title, place: paragraphAt(chapter.startParagraphIndex).place };
            }),
          }),
  });
}
