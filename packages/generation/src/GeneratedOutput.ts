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
  coreClaim: string;
  thin: boolean;
  keyPoints: GeneratedTimedText[];
  chapters: ChapterShape[];
  matchedTopicNames: string[];
  suggestedTopic: SuggestedTopicShape | null;
  tags: string[];
  recipe: GeneratedRecipe | null;
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
  howToApply?: {
    items: string[];
  };
  watchAnyway?: SegmentRangeShape & {
    answer: WatchAnswer;
    reason: string;
  };
}
