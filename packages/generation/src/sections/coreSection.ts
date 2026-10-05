import { z } from "zod";
import { CoreFields, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { SegmentRangeShape } from "./watchAnywaySection.js";

export const KEY_POINT_TARGET_WORDS = 40;
export const KEY_POINT_MAX_WORDS = 50;

export const coreSection: PromptSection = {
  title: "Core",
  key: "structural",
  prompt: () => `
## In one line
What this video IS, not what it argues. One sentence, 25 words at most.
Cover the format and the subject: who is talking and what territory it
covers. This is the line I read when scanning, so it has to be enough on
its own for me to remember which video this was.
Good: "A 20 minute talking head walking through screen time rules age by
age, from babies to teenagers."
Bad: "An insightful exploration of modern parenting challenges."
Never start it with "This video" or "A video about". Never repeat the
channel name — it already has its own field.

## Core claim
One sentence, 60 words at most. The single most important thing to take
from this video: the claim, if it's arguing one; the substance, plainly
described, if it's showing or explaining something instead. If it asserts
nothing and is pure vibes, say so plainly and set thin to true.

## Key points
3 to 7 points. Substance only. Strip the hook, the story, the
restatement, and the call to action. Most videos need five or fewer.
Seven is the ceiling however long the video is: a two hour debate still
gets seven at most, so keep the ones that matter most and let the
chapters carry the rest of the structure.

Each point is one to three complete sentences, ${KEY_POINT_TARGET_WORDS} words at most,
that make sense heard on their own: never a noun phrase or a fragment.
Most points need one or two sentences. Use a further sentence for the
specific detail or example rather than dropping it, and never to restate.

Keep the specifics that make a point worth having: names, numbers,
dates, studies, and the concrete cues or steps. Always keep any caveat,
criticism or counter-argument the video itself raises, and keep who
claims something when the video presents it as one person's claim rather
than settled fact.

Each is read aloud after a linking word such as "First," or "Then,", so
never open a point with its own number, a label and a colon, or a heading.
Good: "Adding sets grows the arms faster than adding weight, as long as
each set is taken close to failure."
Bad: "Volume over load."

Give each point the stretch of the video it comes from, as
startSegmentIndex/endSegmentIndex taken from the numbered transcript
segments below, so the reader can go to it; don't estimate a time. Use
null for a point the video builds across several places rather than in
one stretch.`,
  schemaShape: (input) => ({
    ...CoreFields.shape,
    keyPoints: z
      .object({
        text: z.string().refine((point) => wordCount(point) <= KEY_POINT_MAX_WORDS, `max ${KEY_POINT_MAX_WORDS} words`),
        range: input.transcript.length === 0 ? z.null() : SegmentRangeShape.nullable(),
      })
      .array()
      .min(3)
      .max(7),
  }),
};
