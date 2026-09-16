import type { Novelty, SellingType, WatchAnswer } from "@digest/types";
import type { SuggestedTopicShape } from "./sections/filingSection.js";
import type { SegmentRangeShape } from "./sections/watchAnywaySection.js";

export interface GeneratedOutput {
  inOneLine: string;
  coreClaim: string;
  thin: boolean;
  keyPoints: string[];
  matchedTopicNames: string[];
  suggestedTopic: SuggestedTopicShape | null;
  tags: string[];
  verdict?: {
    novelty: Novelty;
    dubious: boolean;
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
  watchAnyway?: {
    answer: WatchAnswer;
    reason: string;
    range: SegmentRangeShape | null;
  };
}
