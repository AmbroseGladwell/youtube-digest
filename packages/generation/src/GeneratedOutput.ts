import type { Novelty, SellingType, WatchAnswer } from "@overview/domain";
import type { SuggestedTopicShape } from "./sections/filingSection.js";
import type { SegmentRangeShape } from "./sections/segmentRangeFields.js";
import type { ChapterShape } from "./sections/chaptersSection.js";
import type { DubiousClaimShape } from "./sections/verdictSection.js";
import type { GeneratedRecipe } from "./sections/recipeSection.js";

export interface GeneratedTimedText extends SegmentRangeShape {
  text: string;
}

export interface GeneratedOutput {
  inOneLine: string;
  bigPicture: string;
  coreClaim: string;
  thin: boolean;
  keyPoints: GeneratedTimedText[];
  chapters: ChapterShape[];
  matchedTopicNames: string[];
  suggestedTopic: SuggestedTopicShape | null;
  tags: string[];
  verdict?: {
    novelty: Novelty;
    standsOut: GeneratedTimedText | null;
    dubiousClaims: DubiousClaimShape[];
    reasoning: string;
    similarToIndices: number[];
  };
  selling?: {
    type: SellingType;
    detail: string;
    compromisesContent: boolean;
  };
  sourceSteps: Array<GeneratedTimedText & { dubious: boolean }>;
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
