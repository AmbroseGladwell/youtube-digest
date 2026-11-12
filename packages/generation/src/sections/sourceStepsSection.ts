import { z } from "zod";
import { MOST_SOURCE_STEPS, SOURCE_STEP_MAX_WORDS, SOURCE_STEP_TARGET_WORDS, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { segmentRangeFields } from "./segmentRangeFields.js";

// What a source tells its audience to do, carried whole, so "the overview covers it" is true
// when Watch it anyway says so. Measured by OV-251's steps check (docs/features/source-steps.md).
export const sourceStepsInstructions = (source: "video" | "article", where: string) => `
## The steps it gives
Whenever the ${source} tells me to do something concrete: a protocol, a
routine, a method, or advice I could act on, even when it comes inside an
argument, an interview or a story. Then give every step it gives, in its
order, so I could follow them without the ${source}.
Leaving one out is worse than one too many: a step left out here is lost
to me, because I will not go back to the ${source}.

Count as steps the conditions, amounts and timings a step depends on, what
to avoid where it says so, and how to tell it is working or what to expect
along the way ("if the soreness has faded by day three, you are on track").
Never count a sponsor read, a call to like, subscribe or buy, or a vague
exhortation such as "believe in yourself".

From the ${source} alone: never add a step, a fix or advice of your own.
That belongs in How to apply. Keep a step it gives even when it is shaky,
and set dubious to true when the step rests on a claim that does not hold
up. Otherwise set dubious to false.

Return an empty list only when the ${source} tells me to do nothing at all:
it only reports, reviews, or explains how something works. Never invent
steps to fill it.

Each step is one or two complete sentences, ${SOURCE_STEP_TARGET_WORDS} words at most, that read
naturally after "First," or "Then,": an instruction, never a label and a
colon. Keep its specifics: the amounts, durations and cues.${where}`;

const stepText = z.string().refine((text) => wordCount(text) <= SOURCE_STEP_MAX_WORDS, `max ${SOURCE_STEP_MAX_WORDS} words`);

export const sourceStepsSection: PromptSection = {
  title: "The steps it gives",
  key: "structural",
  prompt: () =>
    sourceStepsInstructions(
      "video",
      `

Give each step the stretch of the video where it is given, as
startSegmentIndex/endSegmentIndex taken from the numbered transcript
segments below, or -1 for both when it has none.`,
    ),
  schemaShape: (input) => ({
    sourceSteps: z
      .object({ text: stepText, ...segmentRangeFields(input), dubious: z.boolean() })
      .array()
      .max(MOST_SOURCE_STEPS),
  }),
};

export const sourceStepsShapeWithoutPlaces = () => ({
  sourceSteps: z.object({ text: stepText, dubious: z.boolean() }).array().max(MOST_SOURCE_STEPS),
});
