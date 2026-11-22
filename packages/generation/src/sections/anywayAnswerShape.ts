import { WatchAnswer, WatchAnyway } from "@overview/domain";
import { z } from "zod";
import type { GenerationInput } from "../GenerationInput.js";
import { NO_SEGMENT, segmentRangeFields } from "./segmentRangeFields.js";
import { transcriptBudget } from "./transcriptBudget.js";

export const WHOLE_OR_NOTHING =
  "Yes or no, plus a reason. This is too short to have a part worth taking on its own, so never answer partial.";

// docs/features/overview-generation-decisions.md, "One note budget".
export const anywayAnswerShape = (input: GenerationInput) =>
  transcriptBudget(input).rangeAllowed
    ? { answer: WatchAnyway.shape.answer, reason: WatchAnyway.shape.reason, ...segmentRangeFields(input) }
    : {
        answer: WatchAnswer.exclude(["partial"]),
        reason: WatchAnyway.shape.reason,
        startSegmentIndex: z.literal(NO_SEGMENT),
        endSegmentIndex: z.literal(NO_SEGMENT),
      };
