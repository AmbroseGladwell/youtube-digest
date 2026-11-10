import type { Novelty, SellingType, WatchAnswer } from "@overview/domain";
import type { SuggestedTopicShape } from "./sections/filingSection.js";
import type { QuoteRangeShape, SegmentRangeShape } from "./sections/segmentRangeFields.js";
import type { ChapterShape } from "./sections/chaptersSection.js";
import type { DubiousClaimShape } from "./sections/verdictSection.js";
import type { GeneratedRecipe } from "./sections/recipeSection.js";

export interface GeneratedTimedText extends SegmentRangeShape {
  text: string;
}

export interface GeneratedQuotedText extends GeneratedTimedText, QuoteRangeShape {}

export type GeneratedKeyPoint = GeneratedQuotedText;

export interface GeneratedOutput {
  inOneLine: string;
  bigPicture: string;
  coreClaim: string;
  thin: boolean;
  keyPoints: GeneratedKeyPoint[];
  chapters: ChapterShape[];
  matchedTopicNames: string[];
  suggestedTopic: SuggestedTopicShape | null;
  tags: string[];
  verdict?: {
    novelty: Novelty;
    standsOut: GeneratedQuotedText | null;
    dubiousClaims: DubiousClaimShape[];
    reasoning: string;
    similarToIndices: number[];
  };
  selling?: {
    type: SellingType;
    detail: string;
    compromisesContent: boolean;
  };
  howToApply?: {
    items: string[];
  };
  watchAnyway?: SegmentRangeShape & {
    answer: WatchAnswer;
    reason: string;
  };
}

export type GeneratedRecipeVideoOutput = Pick<
  GeneratedOutput,
  "inOneLine" | "chapters" | "matchedTopicNames" | "suggestedTopic" | "tags"
> & {
  recipe: GeneratedRecipe | null;
};
