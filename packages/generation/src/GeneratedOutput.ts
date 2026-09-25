import type { Novelty, SellingType, WatchAnswer } from "@overview/domain";
import type { SuggestedTopicShape } from "./sections/filingSection.js";
import type { SegmentRangeShape } from "./sections/watchAnywaySection.js";
import type { ChapterShape } from "./sections/chaptersSection.js";

export interface GeneratedOutput {
  inOneLine: string;
  coreClaim: string;
  thin: boolean;
  keyPoints: string[];
  chapters: ChapterShape[];
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
